import os
import zipfile

def main():
    workspace = "/workspaces/dj-controller-project"
    zip_path = os.path.join(workspace, "particle-simulator-build.zip")
    out_dir = os.path.join(workspace, "apps", "particle-simulator")

    if not os.path.exists(zip_path):
        print(f"ERROR: Zip not found: {zip_path}")
        return 1

    os.makedirs(out_dir, exist_ok=True)

    try:
        with zipfile.ZipFile(zip_path, 'r') as z:
            bad = z.testzip()
            if bad:
                print(f"ERROR: Corrupted file in zip: {bad}")
                return 2
            z.extractall(out_dir)
        print(f"OK: Extracted to {out_dir}")
        # List a few files for confirmation
        for root, dirs, files in os.walk(out_dir):
            for name in files[:10]:
                rel = os.path.relpath(os.path.join(root, name), workspace)
                print(f" - {rel}")
            break
        return 0
    except zipfile.BadZipFile:
        print("ERROR: Not a valid zip file")
        return 3

if __name__ == "__main__":
    raise SystemExit(main())
