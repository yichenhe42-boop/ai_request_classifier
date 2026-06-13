from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # 允许插件调用

# 最简单的判断规则（你可以升级为小模型）
def judge_complexity(text):
    text = text.lower()
    # 复杂问题的信号
    complex_indicators = [
        "计算", "推导", "分析", "对比", "代码", "debug", 
        "多少", "为什么", "如何", "步骤", "?" * 3,  # 多个问号
        "|".join(["数学", "物理", "算法", "架构"])
    ]
    score = 0
    for ind in complex_indicators:
        if ind in text:
            score += 1
    # 长度也是信号
    if len(text) > 50:
        score += 1
    # 返回分数和决策（阈值可调）
    is_complex = score >= 1
    return {
        "complexity_score": score,
        "is_complex": is_complex,
        "suggestion": "use_local_gpu" if is_complex else "use_web_api"
    }

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    user_text = data.get("text", "")
    result = judge_complexity(user_text)
    return jsonify(result)

if __name__ == "__main__":
    app.run(port=5678, debug=True)