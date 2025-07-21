import sys
import os

# Add the installed packages to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'site-packages')))

import requests

def main():
    print("Python server running with requests version:", requests.__version__)

if __name__ == "__main__":
    main()
