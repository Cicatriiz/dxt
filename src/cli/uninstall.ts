import { execSync } from "child_process";
import { existsSync, readFileSync, rmSync } from "fs";
import { join, resolve } from "path";
import { DxtManifestSchema } from "../schemas.js";
import { getLogger } from "../shared/log.js";

interface UninstallOptions {
  extensionDir: string;
  silent?: boolean;
}

export async function uninstallExtension({
  extensionDir,
  silent,
}: UninstallOptions): Promise<boolean> {
  const logger = getLogger({ silent });
  const resolvedExtensionDir = resolve(extensionDir);

  if (!existsSync(resolvedExtensionDir)) {
    logger.error(`ERROR: Extension directory not found: ${extensionDir}`);
    return false;
  }

  try {
    // Run pre-uninstall script
    const manifestPath = join(resolvedExtensionDir, "manifest.json");
    if (existsSync(manifestPath)) {
      const manifestContent = readFileSync(manifestPath, "utf-8");
      const manifest = DxtManifestSchema.parse(JSON.parse(manifestContent));

      if (manifest.scripts?.post_uninstall) {
        logger.log("Running post-uninstall script...");
        const script = manifest.scripts.post_uninstall;
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
            execSync(command, { cwd: resolvedExtensionDir, stdio: "inherit" });
            logger.log("Post-uninstall script completed successfully.");
          } catch (error) {
            throw new Error(`Post-uninstall script failed: ${error}`);
          }
        }
      }
    }

    rmSync(resolvedExtensionDir, { recursive: true, force: true });
    logger.log(`Extension uninstalled successfully from ${resolvedExtensionDir}`);
    return true;
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`ERROR: Failed to uninstall extension: ${error.message}`);
    } else {
      logger.error("ERROR: An unknown error occurred during uninstallation.");
    }
    return false;
  }
}
