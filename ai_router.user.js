// ==UserScript==
// @name         AI请求分类机器人（通用探测版）
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  自动探测输入框和发送按钮，兼容 DeepSeek 最新界面
// @match        https://chat.deepseek.com/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';
    console.log('AI请求分类机器人启动 (通用探测版)');

    const BACKEND_URL = 'http://127.0.0.1:5678/analyze';
    const MODEL_URLS = {
        local: 'http://localhost:11434',
        deepseek: 'https://chat.deepseek.com/',
        claude: 'https://claude.ai/'
    };
    const currentHost = window.location.hostname;

    // 增强型输入框查找
    function findInputBox() {
        // 常见选择器列表
        const selectors = [
            'textarea',
            'div[contenteditable="true"]',
            '[contenteditable="true"]',
            'div[role="textbox"]',
            '.chat-input',
            '.input-area',
            '.message-input',
            'div[placeholder*="输入"]',
            'div[placeholder*="message"]'
        ];
        for (let sel of selectors) {
            const el = document.querySelector(sel);
            if (el && (el.tagName === 'TEXTAREA' || el.isContentEditable || el.getAttribute('contenteditable') === 'true')) {
                console.log('找到输入框:', sel, el);
                return el;
            }
        }
        // 如果都没找到，尝试获取当前获得焦点的元素
        if (document.activeElement && (document.activeElement.isContentEditable || document.activeElement.tagName === 'TEXTAREA')) {
            console.log('使用焦点元素作为输入框:', document.activeElement);
            return document.activeElement;
        }
        return null;
    }

    function findSendButton() {
        const selectors = [
            'button[type="submit"]',
            'button.send-btn',
            'button[aria-label*="send" i]',
            'button:has(svg[data-icon="send"])',
            'button:has(svg[data-icon="arrow-up"])',
            'button:contains("发送")',
            'button:contains("Send")'
        ];
        for (let sel of selectors) {
            try {
                const btn = document.querySelector(sel);
                if (btn && btn.offsetParent !== null) return btn;
            } catch(e) {}
        }
        // 遍历所有按钮，找文本或图标匹配的
        const btns = document.querySelectorAll('button');
        for (let btn of btns) {
            const text = btn.innerText.toLowerCase();
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (text.includes('发送') || text.includes('send') || aria.includes('send') || 
                btn.querySelector('svg[data-icon="send"], svg[data-icon="arrow-up"]')) {
                console.log('通过内容找到发送按钮:', btn);
                return btn;
            }
        }
        return null;
    }

    // 弹窗代码（同之前的 showModal，略作简化）
    function showModal(questionText, recommendation, targetUrl, suggestion) {
        const existing = document.getElementById('ai-router-modal');
        if (existing) existing.remove();
        const modal = document.createElement('div');
        modal.id = 'ai-router-modal';
        modal.style.cssText = `position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:white; color:#1e1e2f; padding:24px; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,0.3); z-index:10000; width:500px; max-width:90vw; font-family:sans-serif; border:2px solid #007bff; text-align:left;`;
        const shortQuestion = questionText.length > 150 ? questionText.slice(0,150)+'…' : questionText;
        let buttonHtml = '';
        let isSameSite = false;
        if (recommendation === 'use_deepseek' && currentHost.includes('deepseek')) {
            isSameSite = true;
            buttonHtml = `<button id="ai-use-this" style="background:#28a745; color:white; border:none; padding:8px 16px; border-radius:8px; cursor:pointer;">✅ 直接使用当前页面发送</button>`;
        } else if (recommendation === 'use_claude' && currentHost.includes('claude')) {
            isSameSite = true;
            buttonHtml = `<button id="ai-use-this" style="background:#28a745; color:white; border:none; padding:8px 16px; border-radius:8px; cursor:pointer;">✅ 直接使用当前页面发送</button>`;
        } else {
            let btnText = '';
            if (recommendation === 'use_local') btnText = '📋 复制问题并打开本地 Ollama';
            else if (recommendation === 'use_deepseek') btnText = '📋 复制问题并打开 DeepSeek';
            else btnText = '📋 复制问题并打开 Claude';
            buttonHtml = `<button id="ai-copy-target" style="background:#007bff; color:white; border:none; padding:8px 16px; border-radius:8px; cursor:pointer;">${btnText}</button>`;
        }
        modal.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:16px;">
                <h3 style="margin:0; color:#007bff;">🤖 智能任务分类建议</h3>
                <button id="ai-close-modal" style="background:none; border:none; font-size:20px; cursor:pointer;">&times;</button>
            </div>
            <p style="margin:0 0 12px 0; font-size:14px;">${escapeHtml(suggestion)}</p>
            <div style="background:#f5f5f7; padding:12px; border-radius:8px; margin-bottom:20px;">
                <strong>您的问题：</strong><br>${escapeHtml(shortQuestion)}
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                ${buttonHtml}
                <button id="ai-continue" style="background:#e9ecef; border:none; padding:8px 16px; border-radius:8px;">✖️ 忽略建议</button>
            </div>
        `;
        document.body.appendChild(modal);
        const close = () => modal.remove();
        document.getElementById('ai-close-modal').addEventListener('click', close);
        document.getElementById('ai-continue').addEventListener('click', close);
        if (isSameSite) {
            document.getElementById('ai-use-this').addEventListener('click', () => {
                const input = findInputBox();
                if (input) {
                    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') input.value = questionText;
                    else input.innerText = questionText;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    const sendBtn = findSendButton();
                    if (sendBtn) sendBtn.click();
                    else alert('问题已填入，请手动发送');
                }
                close();
            });
        } else {
            document.getElementById('ai-copy-target').addEventListener('click', () => {
                navigator.clipboard.writeText(questionText).then(() => {
                    alert('问题已复制，即将打开推荐模型页面');
                    window.open(targetUrl, '_blank');
                }).catch(() => alert('复制失败'));
                close();
            });
        }
    }

    function escapeHtml(str) {
        return str.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m] || m));
    }

    function showToast(msg, isErr=false) {
        const toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.cssText = `position:fixed; bottom:20px; right:20px; background:${isErr?'#d32f2f':'#28a745'}; color:white; padding:10px 16px; border-radius:8px; z-index:9999; font-size:14px;`;
        document.body.appendChild(toast);
        setTimeout(()=>toast.remove(),3000);
    }

    function analyzeComplexity(text, callback) {
        GM_xmlhttpRequest({
            method: 'POST',
            url: BACKEND_URL,
            headers: {'Content-Type':'application/json'},
            data: JSON.stringify({text: text}),
            onload: (res) => {
                try { callback(null, JSON.parse(res.responseText)); } catch(e) { callback(e, null); }
            },
            onerror: (err) => callback(err, null)
        });
    }

    // 监听输入事件（回到输入触发但增加防抖）
    function bindInputEvents() {
        const input = findInputBox();
        if (!input) {
            setTimeout(bindInputEvents, 1000);
            return;
        }
        console.log('已绑定输入框，开始监听输入');
        let timer;
        const handler = () => {
            const text = input.value || input.innerText || '';
            if (text.length < 5) return;
            clearTimeout(timer);
            timer = setTimeout(() => {
                console.log('输入稳定，触发分析');
                analyzeComplexity(text, (err, result) => {
                    if (err) { showToast('后端未启动', true); return; }
                    if (result && result.recommendation) {
                        showModal(text, result.recommendation, result.target_url, result.suggestion);
                    }
                });
            }, 800);
        };
        input.addEventListener('input', handler);
        // 对于 contenteditable，也需要监听
        if (input.isContentEditable) {
            input.addEventListener('blur', handler);
        }
    }

    // 启动
    bindInputEvents();
})();