// ==UserScript==
// @name         AI请求分类机器人（模态提示版）
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  检测复杂问题，弹出大提示框，建议使用本地GPU
// @author       You
// @match        https://chat.deepseek.com/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';
    console.log('AI请求分类机器人已启动（模态提示版）');

    // 配置：本地后端地址
    const BACKEND_URL = 'http://127.0.0.1:5678/analyze';
    // 配置：本地模型 WebUI 地址（例如 Ollama 的默认地址，可改成你自己的）
    const LOCAL_MODEL_URL = 'http://localhost:11434';

    // 创建模态框函数
    function showModal(questionText) {
        // 如果已经存在模态框，先移除旧的
        const existingModal = document.getElementById('ai-router-modal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'ai-router-modal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            color: #1e1e2f;
            padding: 24px;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            z-index: 10000;
            width: 460px;
            max-width: 90vw;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            border: 2px solid #007bff;
            text-align: left;
        `;

        const shortQuestion = questionText.length > 120 ? questionText.slice(0, 120) + '…' : questionText;

        modal.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="margin:0; color:#007bff;">🧠 检测到复杂问题</h3>
                <button id="ai-close-modal" style="background:none; border:none; font-size:20px; cursor:pointer; color:#888;">&times;</button>
            </div>
            <p style="margin: 0 0 12px 0; font-size:14px; color:#555;">建议使用本地GPU模型处理，以获得更深度的推理和更低的成本。</p>
            <div style="background: #f5f5f7; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size:14px; word-break: break-word;">
                <strong>您的问题：</strong><br>${escapeHtml(shortQuestion)}
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button id="ai-copy-local" style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: bold;">📋 复制问题并打开本地模型</button>
                <button id="ai-continue-cloud" style="background: #e9ecef; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer;">☁️ 继续使用云端</button>
            </div>
        `;

        document.body.appendChild(modal);

        // 关闭模态框的函数
        const closeModal = () => modal.remove();

        // 关闭按钮
        document.getElementById('ai-close-modal').addEventListener('click', closeModal);
        // 继续使用云端
        document.getElementById('ai-continue-cloud').addEventListener('click', closeModal);
        // 复制并打开本地模型
        document.getElementById('ai-copy-local').addEventListener('click', () => {
            navigator.clipboard.writeText(questionText).then(() => {
                alert('问题已复制到剪贴板，即将打开本地模型界面');
                window.open(LOCAL_MODEL_URL, '_blank');
            }).catch(() => {
                alert('复制失败，请手动复制问题');
                window.open(LOCAL_MODEL_URL, '_blank');
            });
            closeModal();
        });
    }

    // 简单的防XSS辅助函数
    function escapeHtml(str) {
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
            return c;
        });
    }

    // 显示简单提示（可选，用于非复杂情况或错误）
    function showToast(message, isError = false) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${isError ? '#d32f2f' : '#28a745'};
            color: white;
            padding: 10px 16px;
            border-radius: 8px;
            z-index: 9999;
            font-family: sans-serif;
            font-size: 14px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // 调用后端分析复杂度
    function analyzeComplexity(text, callback) {
        GM_xmlhttpRequest({
            method: 'POST',
            url: BACKEND_URL,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ text: text }),
            onload: function(res) {
                try {
                    const data = JSON.parse(res.responseText);
                    callback(null, data);
                } catch (e) {
                    callback(e, null);
                }
            },
            onerror: function(err) {
                callback(err, null);
            }
        });
    }

    // 等待输入框并绑定事件
    function waitForInput() {
        const input = document.querySelector('textarea, div[role="textbox"], [contenteditable="true"]');
        if (input) {
            console.log('找到输入框，绑定事件');
            let timer;
            input.addEventListener('input', function(e) {
                const text = e.target.value || e.target.innerText;
                if (text.length < 5) return;
                clearTimeout(timer);
                timer = setTimeout(() => {
                    console.log('触发分析，内容：', text);
                    analyzeComplexity(text, (err, result) => {
                        if (err) {
                            console.error('后端请求失败', err);
                            showToast('❌ 无法连接本地服务，请确认Python服务已启动', true);
                            return;
                        }
                        console.log('后端返回：', result);
                        if (result.is_complex) {
                            showModal(text);
                        } else {
                            // 简单问题：可以静默，或取消下一行注释测试
                            // showToast('✅ 简单问题，走云端', false);
                        }
                    });
                }, 800);
            });
        } else {
            console.log('未找到输入框，重试');
            setTimeout(waitForInput, 500);
        }
    }

    waitForInput();
})();