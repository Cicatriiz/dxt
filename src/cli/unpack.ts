import { execSync } from "child_process";
import { unzipSync } from "fflate";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";

import { extractSignatureBlock } from "../node/sign.js";
import { DxtManifestSchema } from "../schemas.js";
import { getLogger } from "../shared/log.js";

interface UnpackOptions {
  dxtPath: string;
  outputDir?: string;
  silent?: boolean;
}

export async function unpackExtension({
  dxtPath,
  outputDir,
  silent,
}: UnpackOptions): Promise<boolean> {
  const logger = getLogger({ silent });
  const resolvedDxtPath = resolve(dxtPath);

  if (!existsSync(resolvedDxtPath)) {
    logger.error(`ERROR: DXT file not found: ${dxtPath}`);
    return false;
  }

  const finalOutputDir = outputDir ? resolve(outputDir) : process.cwd();

  if (!existsSync(finalOutputDir)) {
    mkdirSync(finalOutputDir, { recursive: true });
  }

  try {
    const fileContent = readFileSync(resolvedDxtPath);
    const { originalContent } = extractSignatureBlock(fileContent);

    const decompressed = unzipSync(originalContent);

    for (const relativePath in decompressed) {
      if (Object.prototype.hasOwnProperty.call(decompressed, relativePath)) {
        const data = decompressed[relativePath];
        const fullPath = join(finalOutputDir, relativePath);
        const dir = join(fullPath, "..");
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(fullPath, data);
      }
    }

    // Run post-install script
    const manifestPath = join(finalOutputDir, "manifest.json");
    if (existsSync(manifestPath)) {
      const manifestContent = readFileSync(manifestPath, "utf-8");
      const manifest = DxtManifestSchema.parse(JSON.parse(manifestContent));

      if (manifest.scripts?.post_install) {
        logger.log("Running post-install script...");
        const script = manifest.scripts.post_install;
        let command: string | undefined;

        if (typeof script === "string") {
          command = script;
        } else if (typeof script === "object") {
          if ("command" in script && script.command) {
            command = `${script.command} ${
              script.args?.join(" ") ?? ""
            }`.trim();
          } else {
            const platform = process.platform;
            if (platform === "win32" && "windows" in script && script.windows) {
              command = script.windows;
            } else if (
              platform === "darwin" &&
              "darwin" in script &&
              script.darwin
            ) {
              command = script.darwin;
            } else if (
              platform === "linux" &&
              "linux" in script &&
              script.linux
            ) {
              command = script.linux;
            }
          }
        }

        if (command) {
          try {
            execSync(command, { cwd: finalOutputDir, stdio: "inherit" });
            logger.log("Post-install script completed successfully.");
          } catch (error) {
            throw new Error(`Post-install script failed: ${error}`);
          }
        }
      }
    }

    logger.log(`Extension unpacked successfully to ${finalOutputDir}`);
    return true;
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`ERROR: Failed to unpack extension: ${error.message}`);
    } else {
      logger.error("ERROR: An unknown error occurred during unpacking.");
    }
    return false;
  }
}
