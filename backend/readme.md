  cd backend
  python -m venv venv
  .\venv\Scripts\Activate.ps1
  pip install -r requirements.txt

  python app.py   # serves http://127.0.0.1:5050 for the extension

  如果装了uv的话，直接`uv sync`