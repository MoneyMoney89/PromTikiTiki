"""Сборка Teacher Prompt для GitHub Pages, без изменения Flask-файлов."""
from pathlib import Path
import json
import shutil

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "_site"


def main():
    html_file = ROOT / "templates" / "index.html"
    js_file = ROOT / "static" / "js" / "app.js"
    css_file = ROOT / "static" / "css" / "style.css"
    json_file = ROOT / "data" / "prompts.json"

    for path in (html_file, js_file, css_file, json_file):
        if not path.exists():
            raise FileNotFoundError(f"Не найден файл: {path.relative_to(ROOT)}")

    data = json.loads(json_file.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("prompts"), list):
        raise ValueError('Неверный формат JSON: ожидается {"prompts": [...]}')

    html = html_file.read_text(encoding="utf-8")
    js = js_file.read_text(encoding="utf-8")
    for name in ("css/style.css", "js/app.js"):
        from_flask = "{{ url_for('static', filename='" + name + "') }}"
        if from_flask not in html:
            raise ValueError(f"Не найдено подключение Flask: {name}")
        html = html.replace(from_flask, "./static/" + name)

    flask_api = "const API_URL = '/api/prompts';"
    if flask_api not in js:
        raise ValueError("Не найдена строка API_URL в app.js")
    js = js.replace(flask_api, "const API_URL = './data/prompts.json';", 1)

    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    (OUTPUT / "static" / "js").mkdir(parents=True)
    (OUTPUT / "static" / "css").mkdir(parents=True)
    (OUTPUT / "data").mkdir(parents=True)

    (OUTPUT / "index.html").write_text(html, encoding="utf-8")
    (OUTPUT / "static" / "js" / "app.js").write_text(js, encoding="utf-8")
    shutil.copy2(css_file, OUTPUT / "static" / "css" / "style.css")
    shutil.copy2(json_file, OUTPUT / "data" / "prompts.json")
    images = ROOT / "static" / "images"
    if images.is_dir():
        shutil.copytree(images, OUTPUT / "static" / "images")
    (OUTPUT / ".nojekyll").write_text("", encoding="utf-8")
    print(f"Сборка завершена: {len(data['prompts'])} конструкторов")


if __name__ == "__main__":
    main()
