from flask import Flask

app = Flask(__name__)

@app.route("/")
def home():
    return """
    <h1>GenAI Add-on Course</h1>
    <h2>Day 1 Activity Completed</h2>
    <p>Flask running on Google Cloud VM</p>
    """

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
