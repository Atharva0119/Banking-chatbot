"""Create Netlify's static publish folder from the Flask page and assets."""

from pathlib import Path
import shutil


ROOT = Path(__file__).resolve().parents[1]
PUBLISH_DIR = ROOT / "public"


def main() -> None:
    template = (ROOT / "templates" / "index.html").read_text(encoding="utf-8")
    template = template.replace(
        "{{ url_for('static', filename='style.css') }}", "/static/style.css"
    )
    template = template.replace(
        "{{ url_for('static', filename='script.js') }}", "/static/script.js"
    )
    if "{{ url_for(" in template:
        raise ValueError("The page contains a template link not handled by this build script.")

    PUBLISH_DIR.mkdir(parents=True, exist_ok=True)
    (PUBLISH_DIR / "index.html").write_text(template, encoding="utf-8")
    shutil.copytree(ROOT / "static", PUBLISH_DIR / "static", dirs_exist_ok=True)
    print(f"Built static Netlify site in {PUBLISH_DIR}")


if __name__ == "__main__":
    main()
