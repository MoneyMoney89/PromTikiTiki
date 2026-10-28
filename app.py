from flask import Flask, render_template, jsonify
from pathlib import Path
import json
import logging


app = Flask(__name__)

# Путь к корневой папке проекта
BASE_DIR = Path(__file__).resolve().parent

# Путь к файлу с шаблонами промптов
PROMPTS_FILE = BASE_DIR / "data" / "prompts.json"

# Настройка логирования
logging.basicConfig(level=logging.INFO)



# ГЛАВНАЯ СТРАНИЦА

@app.route("/")
def index():
    """
    Отображает главную страницу сайта.
    """

    return render_template("index.html")



# API ДЛЯ ПОЛУЧЕНИЯ ПРОМПТОВ

@app.route("/api/prompts", methods=["GET"])
def get_prompts():
    """
    Возвращает список конструкторов и
    шаблонов промптов в формате JSON.
    """

    try:

        # Открываем JSON-файл
        with open(PROMPTS_FILE, "r", encoding="utf-8") as file:
            data = json.load(file)

        # Проверяем базовую структуру файла
        if not isinstance(data, dict) or not isinstance(
            data.get("prompts"), list
        ):
            app.logger.error(
                "Некорректная структура prompts.json"
            )

            return jsonify({
                "error": "Ошибка структуры данных"
            }), 500

        # Возвращаем данные браузеру
        return jsonify(data)

    except FileNotFoundError:

        app.logger.error(
            "Файл prompts.json не найден"
        )

        return jsonify({
            "error": "Библиотека промптов не найдена"
        }), 500

    except json.JSONDecodeError:

        app.logger.error(
            "Ошибка чтения JSON"
        )

        return jsonify({
            "error": "Некорректный формат JSON"
        }), 500

    except OSError:

        app.logger.exception(
            "Ошибка доступа к файлу промптов"
        )

        return jsonify({
            "error": "Не удалось загрузить промпты"
        }), 500



# ЗАПУСК СЕРВЕРА

if __name__ == "__main__":

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )