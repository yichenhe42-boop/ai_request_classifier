from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def classify_task(text: str):
    """根据规则判断任务类型并推荐模型"""
    text_lower = text.lower()
    length = len(text)

    # 1. 文本处理类（概括、阅读回答文本问题）—— 适合本地小模型
    text_processing_keywords = [
        "总结", "概括", "归纳", "简述", "提炼", "阅读以下", "回答下列问题",
        "这篇文章", "这段文字", "主要内容", "中心思想", "解释一下"
    ]
    # 2. 写作类 —— 建议 DeepSeek（性价比高）
    writing_keywords = [
        "写", "作文", "文章", "故事", "诗歌", "信件", "邮件", "文案",
        "创作", "撰写", "描述", "润色"
    ]
    # 3. 代码类 —— 建议 Claude（代码能力强）
    coding_keywords = [
        "代码", "程序", "函数", "类", "debug", "调试", "算法", "数据结构",
        "编程", "实现", "写一个", "python", "java", "javascript", "c++"
    ]
    # 4. 数学类 —— 建议 Claude（推理强）
    math_keywords = [
        "数学", "方程", "积分", "微分", "导数", "矩阵", "向量", "几何",
        "代数", "概率", "统计", "计算", "推导", "证明"
    ]

    def contains_any(text, keywords):
        return any(kw in text for kw in keywords)

    # 优先级：数学/代码 > 写作 > 文本处理（因为代码/数学最难，优先走最强模型）
    if contains_any(text_lower, coding_keywords) or contains_any(text_lower, math_keywords):
        task_type = "coding_or_math"
        recommendation = "use_claude"
        suggestion = "该问题涉及代码或数学，建议使用 Claude（模型能力最强）"
        target_url = "https://claude.ai/"
    elif contains_any(text_lower, writing_keywords):
        task_type = "writing"
        recommendation = "use_deepseek"
        suggestion = "该问题属于写作类，推荐使用 DeepSeek（成本低，效果好）"
        target_url = "https://chat.deepseek.com/"
    else:
        # 默认归为文本处理（包括概括、问答等简单任务）
        task_type = "text_processing"
        recommendation = "use_local"
        suggestion = "该问题属于文本处理类，适合本地小模型（如 Ollama），无需消耗云端 Token"
        target_url = "http://localhost:11434"  # Ollama 默认地址

    # 长度辅助：如果文本特别长（>200），即使是文本处理也可能复杂，可升级推荐（可选逻辑）
    if task_type == "text_processing" and length > 200:
        # 长文本概括可以保留本地，但也可给出提示，这里保持原推荐
        pass

    return {
        "task_type": task_type,
        "recommendation": recommendation,
        "target_url": target_url,
        "suggestion": suggestion,
        "text_length": length
    }

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    user_text = data.get("text", "")
    if not user_text:
        return jsonify({"error": "No text provided"}), 400
    result = classify_task(user_text)
    return jsonify(result)

if __name__ == "__main__":
    app.run(port=5678, debug=True)