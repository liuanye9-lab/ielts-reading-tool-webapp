/* ================= WebApp MVP Supabase integration =================
   填写方式二选一：
   1. 在页面“云端账号 -> Supabase 配置”里填写 Project URL 和 anon public key。
   2. 直接把下面两个常量改成你的 Supabase 项目配置。
   注意：只能使用 anon public key，不能把 service_role key 放在前端。
*/
const CLOUD_DEFAULT_SUPABASE_URL = "";
const CLOUD_DEFAULT_SUPABASE_ANON_KEY = "";
const CLOUD_CONFIG_STORAGE_KEY = "ieltsSupabaseConfig";
let supabaseClient = null;
let currentCloudProjectId = localStorage.getItem("ieltsCurrentCloudProjectId") || null;

function getStoredSupabaseConfig() {
    try {
        const saved = JSON.parse(localStorage.getItem(CLOUD_CONFIG_STORAGE_KEY) || "{}");
        return {
            url: saved.url || CLOUD_DEFAULT_SUPABASE_URL,
            anonKey: saved.anonKey || CLOUD_DEFAULT_SUPABASE_ANON_KEY
        };
    } catch (error) {
        return { url: CLOUD_DEFAULT_SUPABASE_URL, anonKey: CLOUD_DEFAULT_SUPABASE_ANON_KEY };
    }
}

function isValidSupabaseConfig(config = getStoredSupabaseConfig()) {
    return !!(config.url && config.anonKey && /^https:\/\/.+\.supabase\.co\/?$/.test(config.url.trim()));
}

function initSupabaseClient() {
    const config = getStoredSupabaseConfig();
    if (!window.supabase || !isValidSupabaseConfig(config)) {
        supabaseClient = null;
        updateCloudStatus("未配置 Supabase。请打开「登录 / 云端同步」填写 Project URL 和 anon public key。");
        return null;
    }
    supabaseClient = window.supabase.createClient(config.url.trim(), config.anonKey.trim());
    updateCloudStatus("Supabase 已配置，等待登录。");
    return supabaseClient;
}

function ensureSupabaseClient() {
    if (supabaseClient) return supabaseClient;
    return initSupabaseClient();
}

function updateCloudStatus(message) {
    const status = document.getElementById("cloud-auth-status");
    if (status) status.textContent = message;
}

function setAuthButtonText(text) {
    const el = document.getElementById("auth-status-text");
    if (el) el.textContent = text;
}

function formatDateTime(value) {
    if (!value) return "未知时间";
    try { return new Date(value).toLocaleString("zh-CN", { hour12: false }); }
    catch (error) { return String(value); }
}

function openAuthModal() {
    const config = getStoredSupabaseConfig();
    const urlInput = document.getElementById("supabase-url-input");
    const keyInput = document.getElementById("supabase-anon-key-input");
    if (urlInput) urlInput.value = config.url || "";
    if (keyInput) keyInput.value = config.anonKey || "";
    showModal("cloud-auth-modal");
    refreshCloudAuthStatus();
}
function closeAuthModal() { hideModal("cloud-auth-modal"); }

function saveSupabaseConfigFromModal() {
    const url = document.getElementById("supabase-url-input")?.value.trim() || "";
    const anonKey = document.getElementById("supabase-anon-key-input")?.value.trim() || "";
    if (!url || !anonKey) {
        alert("请填写 Supabase Project URL 和 anon public key");
        return;
    }
    localStorage.setItem(CLOUD_CONFIG_STORAGE_KEY, JSON.stringify({ url, anonKey }));
    initSupabaseClient();
    alert("Supabase 配置已保存");
    refreshCloudAuthStatus();
}

async function refreshCloudAuthStatus() {
    const client = ensureSupabaseClient();
    if (!client) {
        setAuthButtonText("配置云端");
        return null;
    }
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) {
        updateCloudStatus("当前状态：未登录。登录后才能云端保存和恢复项目。");
        setAuthButtonText("登录");
        return null;
    }
    updateCloudStatus(`当前登录：${data.user.email || data.user.id}`);
    setAuthButtonText("已登录");
    return data.user;
}

async function getCurrentCloudUser() {
    const client = ensureSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) return null;
    return data.user;
}

async function handleCloudSignUp() {
    const client = ensureSupabaseClient();
    if (!client) { openAuthModal(); return; }
    const email = document.getElementById("cloud-email")?.value.trim();
    const password = document.getElementById("cloud-password")?.value.trim();
    if (!email || !password) { alert("请输入邮箱和密码"); return; }
    const { error } = await client.auth.signUp({ email, password });
    if (error) { alert("注册失败：" + error.message); return; }
    alert("注册请求已提交。如果 Supabase 开启了邮箱确认，请先去邮箱完成确认。");
    refreshCloudAuthStatus();
}

async function handleCloudLogin() {
    const client = ensureSupabaseClient();
    if (!client) { openAuthModal(); return; }
    const email = document.getElementById("cloud-email")?.value.trim();
    const password = document.getElementById("cloud-password")?.value.trim();
    if (!email || !password) { alert("请输入邮箱和密码"); return; }
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) { alert("登录失败：" + error.message); return; }
    alert("登录成功");
    refreshCloudAuthStatus();
}

async function handleCloudSignOut() {
    const client = ensureSupabaseClient();
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) { alert("退出失败：" + error.message); return; }
    currentCloudProjectId = null;
    localStorage.removeItem("ieltsCurrentCloudProjectId");
    alert("已退出登录");
    refreshCloudAuthStatus();
}

function collectLineRecords() {
    return lines
        .filter(item => item.startEl?.id && item.endEl?.id)
        .map(item => ({ startId: item.startEl.id, endId: item.endEl.id, label: item.label || "" }));
}

function collectCurrentAppState() {
    return {
        schemaVersion: 1,
        savedAt: new Date().toISOString(),
        passageHTML: passageWorkspace?.innerHTML || "",
        questionsHTML: questionsWorkspace?.innerHTML || "",
        questionGroups: parsedQuestionGroups || [],
        vocabularyList: vocabularyList || [],
        lineRecords: collectLineRecords(),
        typography: {
            fontSize: document.getElementById("font-size-slider")?.value || "1.1",
            lineHeight: document.getElementById("line-height-slider")?.value || "2.8"
        }
    };
}

function refreshChunkCounter() {
    const ids = Array.from(document.querySelectorAll(".chunk[id^='chunk-']"))
        .map(el => Number(String(el.id).replace("chunk-", "")))
        .filter(Number.isFinite);
    chunkIdCounter = ids.length ? Math.max(...ids) + 1 : chunkIdCounter;
}

function restoreLineRecords(records = [], shouldSaveAfter = false) {
    clearAllLines(false);
    if (!Array.isArray(records) || !records.length) return;
    setTimeout(() => {
        records.forEach(record => {
            const startEl = document.getElementById(record.startId);
            const endEl = document.getElementById(record.endId);
            if (!startEl || !endEl || startEl === endEl) return;
            const newLineId = drawLine(startEl, endEl, false);
            if (record.label && newLineId) {
                const lineObj = lines.find(l => l.id === newLineId);
                if (lineObj) {
                    lineObj.label = record.label;
                    const newColor = lineColorsMap[record.label] || 'rgba(142, 158, 171, 0.6)';
                    const labelEl = document.createElement('div');
                    labelEl.className = 'capsule-label';
                    labelEl.textContent = record.label;
                    labelEl.style.display = 'inline-block';
                    labelEl.style.zIndex = '50';
                    lineObj.line.setOptions({ middleLabel: labelEl, color: newColor, dash: { len: 5, gap: 5 } });
                }
            }
        });
        updateLinesThrottled?.();
        if (shouldSaveAfter) saveCurrentProject();
    }, 120);
}

function normalizeCloudAppState(rawState = {}) {
    // 兼容两种情况：Supabase jsonb 返回对象；旧数据/异常数据可能返回 JSON 字符串。
    if (!rawState) return {};
    if (typeof rawState === "string") {
        try { return JSON.parse(rawState); }
        catch (error) { console.warn("云端 app_state 不是有效 JSON", error); return {}; }
    }
    return rawState;
}

function stripHTMLForCheck(html = "") {
    const box = document.createElement("div");
    box.innerHTML = String(html || "");
    return (box.textContent || "").replace(/\s+/g, "").trim();
}

function hasMeaningfulAppState(rawState = {}) {
    const state = normalizeCloudAppState(rawState);
    const passageText = stripHTMLForCheck(state.passageHTML || "");
    const questionsText = stripHTMLForCheck(state.questionsHTML || "");
    const hasGroups = Array.isArray(state.questionGroups) && state.questionGroups.length > 0;
    const hasOldGroups = Array.isArray(state.parsedQuestionGroups) && state.parsedQuestionGroups.length > 0;
    const hasVocab = Array.isArray(state.vocabularyList) && state.vocabularyList.length > 0;
    return passageText.length > 10 || questionsText.length > 10 || hasGroups || hasOldGroups || hasVocab;
}

function restoreAppState(rawState = {}) {
    const state = normalizeCloudAppState(rawState);
    if (!state || typeof state !== "object") {
        alert("云端项目数据格式异常，无法恢复。");
        return false;
    }

    clearAllLines(false);

    // 先恢复题型结构数据，再恢复 DOM。这样旧版本只保存 questionGroups 时也能重新渲染题目。
    if (Array.isArray(state.questionGroups)) parsedQuestionGroups = state.questionGroups;
    else if (Array.isArray(state.parsedQuestionGroups)) parsedQuestionGroups = state.parsedQuestionGroups;

    if (typeof state.passageHTML === "string" && state.passageHTML.trim()) {
        passageWorkspace.innerHTML = state.passageHTML;
    }

    if (typeof state.questionsHTML === "string" && state.questionsHTML.trim()) {
        questionsWorkspace.innerHTML = state.questionsHTML;
    } else if (Array.isArray(parsedQuestionGroups) && parsedQuestionGroups.length) {
        confirmAndRenderCBT(false);
    }

    if (Array.isArray(state.vocabularyList)) {
        vocabularyList = state.vocabularyList;
        localStorage.setItem('ieltsTrainerVocab', JSON.stringify(vocabularyList));
        updateVocabBadge?.();
    }

    if (state.typography) {
        const fontSlider = document.getElementById("font-size-slider");
        const lineSlider = document.getElementById("line-height-slider");
        if (fontSlider && state.typography.fontSize) fontSlider.value = state.typography.fontSize;
        if (lineSlider && state.typography.lineHeight) lineSlider.value = state.typography.lineHeight;
        updateTypography?.();
    }

    refreshChunkCounter();
    const restoredLineRecords = Array.isArray(state.lineRecords) ? state.lineRecords : [];
    restoreLineRecords(restoredLineRecords, true);
    if (!restoredLineRecords.length) saveCurrentProject();

    // 明确返回是否真的恢复到了可见内容，方便云端打开时给用户提示。
    return hasMeaningfulAppState(state);
}

async function saveProjectToCloud() {
    const client = ensureSupabaseClient();
    if (!client) { openAuthModal(); return; }
    const user = await getCurrentCloudUser();
    if (!user) { openAuthModal(); alert("请先登录，再保存云端项目"); return; }
    const appState = collectCurrentAppState();

    // 防止误把空白 Welcome/初始页面保存成云项目，导致换浏览器打开后看不到内容。
    if (!hasMeaningfulAppState(appState)) {
        const shouldContinue = confirm("当前项目看起来还没有导入有效原文或题目。仍然要保存一个空项目吗？");
        if (!shouldContinue) return;
    }

    let title = localStorage.getItem("ieltsCurrentProjectTitle") || "IELTS Reading Project";
    const inputTitle = prompt("项目名称：", title);
    if (inputTitle !== null && inputTitle.trim()) title = inputTitle.trim();
    localStorage.setItem("ieltsCurrentProjectTitle", title);

    let result;
    if (currentCloudProjectId) {
        result = await client
            .from("reading_projects")
            .update({ title, app_state: appState, updated_at: new Date().toISOString() })
            .eq("id", currentCloudProjectId)
            .select("id")
            .maybeSingle();
    }
    if (!currentCloudProjectId || result?.error || !result?.data) {
        result = await client
            .from("reading_projects")
            .insert({ user_id: user.id, title, app_state: appState })
            .select("id")
            .single();
    }
    if (result.error) { alert("云端保存失败：" + result.error.message); return; }
    currentCloudProjectId = result.data.id;
    localStorage.setItem("ieltsCurrentCloudProjectId", currentCloudProjectId);
    alert("已保存到云端");
    renderCloudProjectsList(false);
}

function closeCloudProjectsModal() { hideModal("cloud-projects-modal"); }
async function openCloudProjectsModal() {
    showModal("cloud-projects-modal");
    await renderCloudProjectsList();
}

async function renderCloudProjectsList(showNeedLoginAlert = true) {
    const list = document.getElementById("cloud-projects-list");
    if (!list) return;
    const client = ensureSupabaseClient();
    if (!client) {
        list.innerHTML = `<div class="cloud-empty">还没有配置 Supabase。点击顶部「登录」填写 Project URL 和 anon public key。</div>`;
        if (showNeedLoginAlert) openAuthModal();
        return;
    }
    const user = await getCurrentCloudUser();
    if (!user) {
        list.innerHTML = `<div class="cloud-empty">请先登录，然后再查看云端项目。</div>`;
        if (showNeedLoginAlert) openAuthModal();
        return;
    }
    list.innerHTML = `<div class="cloud-empty">正在读取云端项目...</div>`;
    const { data, error } = await client
        .from("reading_projects")
        .select("id, title, created_at, updated_at")
        .order("updated_at", { ascending: false });
    if (error) {
        list.innerHTML = `<div class="cloud-empty">读取失败：${escapeHTML(error.message)}</div>`;
        return;
    }
    if (!data?.length) {
        list.innerHTML = `<div class="cloud-empty">暂无云端项目。先导入文档并点击「云端保存」。</div>`;
        return;
    }
    list.innerHTML = data.map(project => `
        <div class="cloud-project-item">
            <div>
                <div class="cloud-project-title">${escapeHTML(project.title || '未命名阅读项目')} ${project.id === currentCloudProjectId ? '<span class="cloud-badge">当前</span>' : ''}</div>
                <div class="cloud-project-meta">更新：${escapeHTML(formatDateTime(project.updated_at))}<br>创建：${escapeHTML(formatDateTime(project.created_at))}</div>
            </div>
            <div class="cloud-project-actions">
                <button onclick="restoreProjectFromCloud('${project.id}')">打开</button>
                <button onclick="duplicateCloudProject('${project.id}')">复制</button>
                <button class="danger" onclick="deleteCloudProject('${project.id}')">删除</button>
            </div>
        </div>
    `).join("");
}

async function restoreProjectFromCloud(projectId) {
    const client = ensureSupabaseClient();
    if (!client) { openAuthModal(); return; }
    const user = await getCurrentCloudUser();
    if (!user) { openAuthModal(); return; }
    const { data, error } = await client
        .from("reading_projects")
        .select("id, title, app_state")
        .eq("id", projectId)
        .single();
    if (error) { alert("打开失败：" + error.message); return; }

    const state = normalizeCloudAppState(data.app_state || {});
    if (!hasMeaningfulAppState(state)) {
        alert("这个云端项目里没有有效的原文/题干内容。大概率是之前误保存了空白项目，请回到原浏览器打开有内容的页面后重新点击「云端保存」。");
        return;
    }

    currentCloudProjectId = data.id;
    localStorage.setItem("ieltsCurrentCloudProjectId", data.id);
    localStorage.setItem("ieltsCurrentProjectTitle", data.title || "IELTS Reading Project");

    // 先进入主程序，避免 Welcome 遮罩层导致用户误以为项目没有打开。
    closeCloudProjectsModal();
    enterProgram?.();
    setTimeout(() => {
        const restored = restoreAppState(state);
        alert(restored ? "项目已恢复" : "项目已打开，但未检测到可见原文/题干内容");
    }, 420);
}

async function duplicateCloudProject(projectId) {
    const client = ensureSupabaseClient();
    const user = await getCurrentCloudUser();
    if (!client || !user) { openAuthModal(); return; }
    const { data, error } = await client
        .from("reading_projects")
        .select("title, app_state")
        .eq("id", projectId)
        .single();
    if (error) { alert("复制失败：" + error.message); return; }
    const { error: insertError } = await client
        .from("reading_projects")
        .insert({ user_id: user.id, title: `${data.title || '未命名阅读项目'} · copy`, app_state: data.app_state || {} });
    if (insertError) { alert("复制失败：" + insertError.message); return; }
    renderCloudProjectsList(false);
}

async function deleteCloudProject(projectId) {
    if (!confirm("确认删除这个云端项目？删除后无法恢复。")) return;
    const client = ensureSupabaseClient();
    if (!client) { openAuthModal(); return; }
    const { error } = await client.from("reading_projects").delete().eq("id", projectId);
    if (error) { alert("删除失败：" + error.message); return; }
    if (currentCloudProjectId === projectId) {
        currentCloudProjectId = null;
        localStorage.removeItem("ieltsCurrentCloudProjectId");
    }
    renderCloudProjectsList(false);
}

window.addEventListener("DOMContentLoaded", () => {
    initSupabaseClient();
    setTimeout(refreshCloudAuthStatus, 300);
});

/* ================= 核心状态区 ================= */
        let chunkIdCounter = 0;
        let lines = [];
        let selectedChunkForLine = null;
        let hoveredChunk = null; 
        let lastCreatedChunk = null; 
        let activeLineId = null; 
        let parsedQuestionGroups = []; 
        
        let vocabularyList = [];
        try { const savedVocab = localStorage.getItem('ieltsTrainerVocab'); if(savedVocab) vocabularyList = JSON.parse(savedVocab); } catch(e) {}
        function updateVocabBadge() { document.getElementById('vocab-count-badge').innerText = vocabularyList.length; }
        window.addEventListener('DOMContentLoaded', updateVocabBadge);
        
        const passageWorkspace = document.getElementById('passage-workspace');
        const questionsWorkspace = document.getElementById('questions-workspace');
        const leftPanel = document.getElementById('left-panel');
        const rightPanel = document.getElementById('right-panel');
        const splitContainer = document.getElementById('split-container');
        const resizer = document.getElementById('drag-bar');

        /* --- 1. 排版动态调节器 (Typography) --- */
        function toggleTypographyPopover() {
            const popover = document.getElementById('typography-popover');
            popover.classList.toggle('hidden');
        }

        // 点击页面空白处关闭排版调节器
        document.addEventListener('click', (e) => {
            const popover = document.getElementById('typography-popover');
            const btn = popover.previousElementSibling;
            if (!popover.contains(e.target) && !btn.contains(e.target) && !popover.classList.contains('hidden')) {
                popover.classList.add('hidden');
            }
        });

        function updateTypography() {
            const fSize = document.getElementById('font-size-slider').value;
            const lHeight = document.getElementById('line-height-slider').value;
            
            document.getElementById('font-size-val').innerText = `${fSize}rem`;
            document.getElementById('line-height-val').innerText = Number(lHeight).toFixed(1);

            // 修改 CSS 变量，全局生效
            document.documentElement.style.setProperty('--reading-font-size', `${fSize}rem`);
            document.documentElement.style.setProperty('--cbt-font-size', `${fSize * 0.9}rem`); // 题干比原文小一点
            document.documentElement.style.setProperty('--reading-line-height', lHeight);
            
            // 延迟重绘连线以适应新的排版高度
            setTimeout(updateLinesThrottled, 200);
        }

        /* --- 2. 真实双栏拖拽分割计算 (Resizer) --- */
        let isResizing = false;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none'; // 防止拖动时选中文本
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            // 计算鼠标相对于容器的 X 轴百分比
            const containerRect = splitContainer.getBoundingClientRect();
            let newLeftWidthPercent = ((e.clientX - containerRect.left) / containerRect.width) * 100;
            
            // 限制范围在 20% ~ 80% 之间，防止完全遮挡
            if (newLeftWidthPercent > 20 && newLeftWidthPercent < 80) {
                leftPanel.style.width = `${newLeftWidthPercent}%`;
                // 右侧占用剩余宽度，减去 resizer 的安全像素宽度防止折行
                rightPanel.style.width = `calc(${100 - newLeftWidthPercent}% - 16px)`; 
                updateLinesThrottled(); // 实时更新连线防止脱节
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
                document.body.style.userSelect = 'auto';
            }
        });

        /* --- 模态框控制 --- */
        function showModal(id) {
            const modal = document.getElementById(id);
            const content = modal.querySelector('.relative.z-10');
            modal.classList.remove('hidden');
            void modal.offsetWidth;
            modal.classList.remove('opacity-0');
            content.classList.remove('scale-95');
        }
        function hideModal(id) {
            const modal = document.getElementById(id);
            const content = modal.querySelector('.relative.z-10');
            modal.classList.add('opacity-0');
            content.classList.add('scale-95');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
        function openGuideModal() { showModal('guide-modal'); }
        function closeGuideModal() { hideModal('guide-modal'); }
        
        function openInputModal() { 
            document.getElementById('step-1-input').classList.remove('hidden');
            document.getElementById('step-2-review').classList.add('hidden');
            showModal('input-modal'); 
        }
        function closeInputModal() { hideModal('input-modal'); }
        function backToStep1() {
            document.getElementById('step-2-review').classList.add('hidden');
            document.getElementById('step-1-input').classList.remove('hidden');
        }

        /* --- IELTS 题干结构化解析 / 校对 / 机考渲染引擎 V2 --- */

        /**
         * 标准数据结构：
         * QuestionGroup = { id, range, type, instruction, questions, sharedOptions, wordLimit, paragraphRange, rawText, confidence }
         * QuestionItem = { id, stem, target, answerInputType, options, userAnswer, status, evidenceBindings }
         * QuestionOption = { label, text }
         */
        let currentProjectId = 'ielts_current_project';
        let activeGroupId = null;
        let activeQuestionId = null;

        const QUESTION_TYPES = [
            ['matching_headings', '段落标题匹配 (Matching Headings)'],
            ['matching_information', '信息匹配 (Matching Information)'],
            ['matching_features', '人物/特征匹配 (Matching Features)'],
            ['matching_sentence_endings', '句尾匹配 (Matching Sentence Endings)'],
            ['multiple_choice', '单选题 (Multiple Choice)'],
            ['multiple_choice_multi', '多选题 (Choose TWO/THREE)'],
            ['summary_completion', '摘要填空 (Summary Completion)'],
            ['sentence_completion', '句子填空 (Sentence Completion)'],
            ['true_false_not_given', '判断题 (TRUE/FALSE/NOT GIVEN)'],
            ['yes_no_not_given', '判断题 (YES/NO/NOT GIVEN)'],
            ['short_answer', '简答题 (Short Answer)'],
            ['table_completion', '表格填空 (Table Completion)'],
            ['flow_chart_completion', '流程图填空 (Flow-chart Completion)'],
            ['diagram_label_completion', '图表标注 (Diagram Label Completion)'],
            ['unknown', '未知题型 (需要手动校对)']
        ];

        function uid(prefix = 'id') {
            return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
        }

        function escapeHTML(str) {
            return String(str ?? '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;')
                .replaceAll('"', '&quot;')
                .replaceAll("'", '&#039;');
        }

        function unescapeHTML(str) {
            const box = document.createElement('textarea');
            box.innerHTML = str ?? '';
            return box.value;
        }

        function normalizeSpaces(str) {
            return String(str ?? '').replace(/[ \t]+/g, ' ').trim();
        }

        function cleanQuestionText(rawText) {
            let text = String(rawText || '')
                .replace(/\r\n?/g, '\n')
                .replace(/[“”]/g, '"')
                .replace(/[‘’]/g, "'")
                .replace(/\u00A0/g, ' ')
                .replace(/[–—]/g, '-')
                .replace(/[。]/g, '.')
                .replace(/[：]/g, ':')
                .replace(/[；]/g, ';')
                .replace(/[，]/g, ',')
                .replace(/[\t ]+/g, ' ')
                .replace(/\n{3,}/g, '\n\n');

            // 标准化题组范围，兼容 Question / Questions / Q / Qs。
            text = text.replace(/\b(?:Q|Qs|Question|Questions)\s*(\d{1,2})\s*(?:-|to)\s*(\d{1,2})\b/gi, 'Questions $1-$2');
            text = text.replace(/\b(?:Q|Qs|Question|Questions)\s*(\d{1,2})\b/gi, 'Questions $1');

            // 关键：把每个题组标题放到独立行，避免整段被当成单一题型。
            text = text.replace(/([^\n])\s+(Questions\s+\d{1,2}(?:-\d{1,2})?)/gi, '$1\n\n$2');
            text = text.replace(/(Questions\s+\d{1,2}(?:-\d{1,2})?)\s+(?=[A-Z])/gi, '$1\n');

            // 把 IELTS 常见 instruction 放到新行；当 OCR 没有 Questions 标题时也能做二次切分。
            const instructionStarters = [
                'Choose the correct heading',
                'Which paragraph contains the following information',
                'Look at the following statements and the list of people',
                'Match each statement with the correct',
                'Complete each sentence with the correct ending',
                'Choose the correct letter',
                'Choose TWO letters',
                'Choose THREE letters',
                'Do the following statements agree with the information given',
                'Do the following claims agree with the views of the writer',
                'Do the following statements agree with the views of the writer',
                'Complete the summary below',
                'Complete the sentences below',
                'Answer the questions below',
                'Complete the table below',
                'Complete the flow-chart below',
                'Label the diagram below',
            ];
            instructionStarters.forEach(starter => {
                const re = new RegExp(`([^\\n])\\s+(${starter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                text = text.replace(re, '$1\n$2');
            });

            // 标准化编号和选项格式。
            text = text
                .replace(/List\s+of\s+headings/gi, 'List of Headings')
                .replace(/(^|\n)\s*(\d{1,2})\s*[\)）．、]\s+/g, '$1$2. ')
                .replace(/(^|\n)\s*([A-F])\s*[\)）．、]\s+/g, '$1$2. ')
                .replace(/(^|\n)\s*(i{1,3}|iv|v|vi{1,3}|ix|x|xi{1,3}|xiv|xv)\s*[\)）．、]\s+/gi, '$1$2. ');

            // 如果题号、普通选项、罗马数字选项被粘在同一行，强制拆行。
            text = text.replace(/([^\n])\s+(\d{1,2})\.\s+(?=[A-Z0-9\[])/g, '$1\n$2. ');
            text = text.replace(/([\?\.!])\s+(\d{1,2})\.?\s+(?=[A-Za-z])/g, '$1\n$2. ');
            for (let i = 0; i < 3; i++) {
                text = text.replace(/([A-Za-z])\s+(\d{1,2})\s+(?=[A-Za-z])/g, '$1\n$2. ');
                text = text.replace(/([A-Za-z])\s+(\d{1,2})\s+(?=_{2,}|\.{3,}|-{2,}|\[[^\]]*blank)/gi, '$1\n$2 ');
                text = text.replace(/([^\n])\s+(\d{1,2})\s+(?=(?:Paragraph|Section)\s+[A-Z])/gi, '$1\n$2 ');
            }
            text = text.replace(/([^\n])\s+(\d{1,2})\s+(?=(?:Paragraph|Section)\s+[A-Z])/gi, '$1\n$2 ');
            text = text.replace(/([\?\.!])\s+([A-F])\.\s+(?=[A-Z0-9\[])/g, '$1\n$2. ');
            text = text.replace(/([\?\.!])\s+([A-F])\s+(?=[A-Z])/g, '$1\n$2. ');
            text = text.replace(/([^\n])\s+(i{1,3}|iv|v|vi{1,3}|ix|x|xi{1,3}|xiv|xv)\.\s+(?=[A-Z0-9\[])/gi, '$1\n$2. ');
            text = text.replace(/([^\n])\s+(i{1,3}|iv|v|vi{1,3}|ix|x|xi{1,3}|xiv|xv)\s+(?=[A-Z])/gi, '$1\n$2. ');
            text = text.replace(/(below\.?)\s+(List of Headings)\s+/gi, '$1\n\n$2\n');
            text = text.replace(/(List of Headings)\s+(?=(?:i{1,3}|iv|v|vi{1,3}|ix|x)\s)/gi, '$1\n');

            // 修复常见 OCR 错误：题号前的 I/l 仅在明显数字语境中处理。
            text = text.replace(/(^|\n)\s*[Il]\s*[\.\)]\s+(?=[A-Z])/g, '$11. ');

            return text.split('\n').map(line => line.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
        }

        function getInstructionPattern() {
            return /(?:Choose the correct heading|Which paragraph contains the following information|Look at the following statements and the list of people|Match each statement with the correct|Complete each sentence with the correct ending|Choose the correct letter|Choose\s+(?:TWO|THREE|2|3)\s+letters|Do the following statements agree with the information given|Do the following claims agree with the views of the writer|Do the following statements agree with the views of the writer|Complete the summary below|Complete the sentences below|Answer the questions below|Complete the table below|Complete the flow-?chart below|Label the diagram below)/i;
        }

        function splitQuestionGroups(cleanText) {
            const text = String(cleanText || '').trim();
            if (!text) return [];

            // 第一层：按 Questions n-m 题组标题切。不要要求它在行首。
            const rangeRe = /Questions\s+\d{1,2}(?:\s*-\s*\d{1,2})?/gi;
            const matches = [];
            let m;
            while ((m = rangeRe.exec(text)) !== null) {
                matches.push({ index: m.index, value: m[0] });
            }

            let blocks = [];
            if (matches.length) {
                for (let i = 0; i < matches.length; i++) {
                    const start = matches[i].index;
                    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
                    const block = text.slice(start, end).trim();
                    if (block) blocks.push(block);
                }
            } else {
                blocks = [`Questions 1-?\n${text}`];
            }

            // 第二层：如果某个 block 内部还塞了多个 IELTS instruction，继续拆。
            // 这解决“没有 Questions 6-10 换行 / OCR 把多个题型粘成一段”的情况。
            const refined = [];
            blocks.forEach((block, blockIndex) => {
                const internal = splitMixedInstructionBlock(block, blockIndex);
                refined.push(...internal);
            });
            return refined.length ? refined : blocks;
        }

        function splitMixedInstructionBlock(block, blockIndex = 0) {
            const range = extractRange(block, blockIndex);
            const body = removeRange(block);
            const instructionRe = new RegExp(getInstructionPattern().source, 'gi');
            const hits = [];
            let m;
            while ((m = instructionRe.exec(body)) !== null) {
                hits.push({ index: m.index, value: m[0] });
            }
            if (hits.length <= 1) return [block];

            const subBlocks = [];
            for (let i = 0; i < hits.length; i++) {
                const start = hits[i].index;
                const end = i + 1 < hits.length ? hits[i + 1].index : body.length;
                const subBody = body.slice(start, end).trim();
                if (!subBody) continue;
                const inferredRange = inferRangeFromBlock(subBody) || `${range} / Part ${i + 1}`;
                subBlocks.push(`${inferredRange}\n${subBody}`);
            }
            return subBlocks.length ? subBlocks : [block];
        }

        function inferRangeFromBlock(text) {
            const ids = [];
            const re = /(?:^|\n)\s*(\d{1,2})[\.\)]?\s+/g;
            let m;
            while ((m = re.exec(text)) !== null) ids.push(Number(m[1]));
            if (!ids.length) return '';
            const min = Math.min(...ids);
            const max = Math.max(...ids);
            return min === max ? `Question ${min}` : `Questions ${min}-${max}`;
        }

        function extractRange(block, fallbackIndex = 0) {
            const match = String(block || '').match(/Questions?\s+\d{1,2}(?:\s*-\s*\d{1,2})?/i);
            return match ? match[0].replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-') : `Questions Group ${fallbackIndex + 1}`;
        }

        function removeRange(block) {
            return String(block || '').replace(/Questions?\s+\d{1,2}(?:\s*-\s*\d{1,2})?/i, '').trim();
        }

        function extractWordLimit(text) {
            const match = String(text || '').match(/(?:ONE WORD ONLY|ONE WORD AND\/OR A NUMBER|NO MORE THAN (?:ONE|TWO|THREE|FOUR) WORDS?(?: AND\/OR A NUMBER)?|NO MORE THAN \d+ WORDS?(?: AND\/OR A NUMBER)?)/i);
            return match ? match[0].toUpperCase() : '';
        }

        function extractParagraphRange(text) {
            const source = String(text || '');
            const match = source.match(/paragraphs?,?\s+([A-Z])\s*[-–—]\s*([A-Z])/i) || source.match(/\b([A-Z])\s*[-–—]\s*([A-Z])\b/);
            if (!match) return 'A-G';
            return `${match[1].toUpperCase()}-${match[2].toUpperCase()}`;
        }

        function paragraphLetters(range) {
            const match = String(range || 'A-G').match(/([A-Z])\s*-\s*([A-Z])/i);
            const start = match ? match[1].toUpperCase().charCodeAt(0) : 65;
            const end = match ? match[2].toUpperCase().charCodeAt(0) : 71;
            const letters = [];
            for (let i = start; i <= end && i <= 90; i++) letters.push(String.fromCharCode(i));
            return letters;
        }

        function detectQuestionType(instruction, bodyText = '') {
            const raw = `${instruction || ''}\n${bodyText || ''}`;
            const text = raw.toLowerCase();

            // 严格按 IELTS instruction 特征识别。顺序很重要：matching heading 也有 choose，必须先于 MCQ。
            if (/choose the correct heading|list of headings/.test(text)) return 'matching_headings';
            if (/which paragraph contains the following information/.test(text)) return 'matching_information';
            if (/look at the following statements and the list of people|look at the following statements and the list of researchers|match each statement with the correct person|match each statement with the correct researcher|list of people|list of researchers/.test(text)) return 'matching_features';
            if (/complete each sentence with the correct ending|sentence endings|choose the correct ending/.test(text)) return 'matching_sentence_endings';
            if (/choose\s+(?:two|three|2|3)\s+letters/.test(text)) return 'multiple_choice_multi';
            if (/choose the correct letter\s*,?\s*a\s*,\s*b\s*,\s*c/i.test(raw) || /choose the correct answer/i.test(text)) return 'multiple_choice';
            if (/do the following statements agree with the information given|do the following statements agree with the information in reading passage/.test(text)) return 'true_false_not_given';
            if (/do the following claims agree with the views of the writer|do the following statements agree with the views of the writer|do the following statements agree with the claims of the writer/.test(text)) return 'yes_no_not_given';
            if (/complete the summary below|complete the summary using the list of words/.test(text)) return 'summary_completion';
            if (/complete the sentences below/.test(text)) return 'sentence_completion';
            if (/answer the questions below/.test(text)) return 'short_answer';
            if (/complete the table below/.test(text)) return 'table_completion';
            if (/complete the flow-?chart below|complete the flow chart below/.test(text)) return 'flow_chart_completion';
            if (/label the diagram below/.test(text)) return 'diagram_label_completion';

            // 兜底：根据结构弱判断，但不给高置信度。
            if (/\bTRUE\b[\s\S]{0,80}\bFALSE\b[\s\S]{0,80}\bNOT GIVEN\b/i.test(raw)) return 'true_false_not_given';
            if (/\bYES\b[\s\S]{0,80}\bNO\b[\s\S]{0,80}\bNOT GIVEN\b/i.test(raw) && !/NO MORE THAN/i.test(raw)) return 'yes_no_not_given';
            if (/\n\s*[A-F][\.\)]\s+/.test(raw) && /\bchoose\b/i.test(raw)) return 'multiple_choice';
            if (/\n\s*(?:i{1,3}|iv|v|vi{1,3}|ix|x)\.?\s+/i.test(raw) && /heading/i.test(raw)) return 'matching_headings';
            return 'unknown';
        }

        function splitInstructionAndBody(block) {
            const body = removeRange(block);
            const firstQuestion = body.search(/(?:^|\n)\s*\d{1,2}[\.\)]?\s+/);
            if (firstQuestion >= 0) {
                return {
                    instruction: body.slice(0, firstQuestion).trim(),
                    bodyText: body.slice(firstQuestion).trim()
                };
            }
            return { instruction: body.trim(), bodyText: '' };
        }

        function createQuestion(id, stem, overrides = {}) {
            const inputType = overrides.answerInputType || 'unknown';
            return {
                id: Number(id),
                stem: normalizeSpaces(stem),
                target: overrides.target || '',
                answerInputType: inputType,
                options: overrides.options || [],
                userAnswer: overrides.userAnswer ?? (inputType === 'checkbox' ? [] : ''),
                status: overrides.status || 'not_started',
                evidenceBindings: overrides.evidenceBindings || []
            };
        }

        function parseGenericNumberedQuestions(bodyText, answerInputType = 'unknown') {
            const normalized = String(bodyText || '').replace(/\n(?=\d{1,2}[\.\)]?\s+)/g, '\n');
            const parts = normalized.split(/(?=^\s*\d{1,2}[\.\)]?\s+)/gm).filter(p => p.trim());
            return parts.map(part => {
                const match = part.match(/^\s*(\d{1,2})[\.\)]?\s+([\s\S]*)$/);
                if (!match) return null;
                return createQuestion(match[1], match[2].trim(), { answerInputType });
            }).filter(Boolean);
        }

        function parseQuestionOptionLines(text) {
            const source = String(text || '').trim();
            const reg = /^\s*([A-F])[\.\)]\s+([\s\S]*?)(?=\n\s*[A-F][\.\)]\s+|$)/gim;
            const options = [];
            let m;
            while ((m = reg.exec(source)) !== null) {
                options.push({ label: m[1].toUpperCase(), text: normalizeSpaces(m[2]) });
            }
            return options;
        }

        function parseRomanOptions(text) {
            const roman = '(?:i{1,3}|iv|v|vi{1,3}|ix|x|xi{1,3}|xiv|xv)';
            const reg = new RegExp(`^\\s*(${roman})[\\.\\)]?\\s+([\\s\\S]*?)(?=\\n\\s*(?:${roman})[\\.\\)]?\\s+|$)`, 'gim');
            const options = [];
            let m;
            while ((m = reg.exec(String(text || ''))) !== null) {
                options.push({ label: m[1].toLowerCase(), text: normalizeSpaces(m[2]) });
            }
            return options;
        }

        function parseMatchingHeadings(block) {
            const range = extractRange(block);
            const body = removeRange(block);
            const listMatch = body.match(/List of Headings/i);
            let instruction = '';
            let listAndTargets = body;
            if (listMatch) {
                instruction = body.slice(0, listMatch.index).trim();
                listAndTargets = body.slice(listMatch.index + listMatch[0].length).trim();
            } else {
                const firstRoman = body.search(/(?:^|\n)\s*(?:i{1,3}|iv|v|vi{1,3}|ix|x)[\.\)]?\s+/i);
                if (firstRoman >= 0) {
                    instruction = body.slice(0, firstRoman).trim();
                    listAndTargets = body.slice(firstRoman).trim();
                }
            }

            const targetStart = listAndTargets.search(/(?:^|\n)\s*\d{1,2}[\.\)]?\s*(?:Paragraph|Section)\s+[A-Z]/i);
            const optionsText = targetStart >= 0 ? listAndTargets.slice(0, targetStart).trim() : listAndTargets;
            const targetsText = targetStart >= 0 ? listAndTargets.slice(targetStart).trim() : '';

            const sharedOptions = parseRomanOptions(optionsText);
            const questions = [];
            const targetReg = /^\s*(\d{1,2})[\.\)]?\s*((?:Paragraph|Section)\s+[A-Z])\s*$/gim;
            let m;
            while ((m = targetReg.exec(targetsText)) !== null) {
                questions.push(createQuestion(m[1], m[2], { target: m[2], answerInputType: 'select' }));
            }
            if (!questions.length) {
                parseGenericNumberedQuestions(targetsText, 'select').forEach(q => {
                    q.target = q.target || q.stem;
                    questions.push(q);
                });
            }

            return {
                id: uid('group'), range, type: 'matching_headings', instruction,
                questions, sharedOptions, wordLimit: '', paragraphRange: '', rawText: block,
                confidence: sharedOptions.length && questions.length ? 0.92 : 0.45
            };
        }

        function parseMatchingInformation(block) {
            const range = extractRange(block);
            const { instruction, bodyText } = splitInstructionAndBody(block);
            const paragraphRange = extractParagraphRange(instruction + '\n' + bodyText);
            return {
                id: uid('group'), range, type: 'matching_information', instruction,
                questions: parseGenericNumberedQuestions(bodyText, 'select'),
                sharedOptions: [], wordLimit: '', paragraphRange, rawText: block, confidence: 0.86
            };
        }

        function parseMatchingListType(block, type) {
            const range = extractRange(block);
            const { instruction, bodyText } = splitInstructionAndBody(block);
            const firstOption = bodyText.search(/(?:^|\n)\s*[A-F][\.\)]\s+/m);
            let questionText = bodyText;
            let sharedOptions = [];
            if (firstOption >= 0) {
                questionText = bodyText.slice(0, firstOption).trim();
                sharedOptions = parseQuestionOptionLines(bodyText.slice(firstOption));
            }
            return {
                id: uid('group'), range, type, instruction,
                questions: parseGenericNumberedQuestions(questionText, 'select'),
                sharedOptions, wordLimit: '', paragraphRange: '', rawText: block, confidence: sharedOptions.length ? 0.78 : 0.55
            };
        }

        function parseMultipleChoice(block, multi = false) {
            const range = extractRange(block);
            const { instruction, bodyText } = splitInstructionAndBody(block);
            const qBlocks = String(bodyText || '').split(/(?=^\s*\d{1,2}[\.\)]?\s+)/gm).filter(Boolean);
            const questions = qBlocks.map(qBlock => {
                const match = qBlock.match(/^\s*(\d{1,2})[\.\)]?\s+([\s\S]*)$/);
                if (!match) return null;
                const id = match[1];
                let content = match[2].trim();
                const firstOption = content.search(/(?:^|\n)\s*[A-F][\.\)]\s+/m);
                let stem = content;
                let options = [];
                if (firstOption >= 0) {
                    stem = content.slice(0, firstOption).trim();
                    options = parseQuestionOptionLines(content.slice(firstOption));
                }
                return createQuestion(id, stem, { answerInputType: multi ? 'checkbox' : 'radio', options });
            }).filter(Boolean);
            return {
                id: uid('group'), range, type: multi ? 'multiple_choice_multi' : 'multiple_choice', instruction,
                questions, sharedOptions: [], wordLimit: '', paragraphRange: '', rawText: block, confidence: questions.length ? 0.88 : 0.45
            };
        }

        function parseTFNG(block, type = 'true_false_not_given') {
            const range = extractRange(block);
            const { instruction, bodyText } = splitInstructionAndBody(block);
            return {
                id: uid('group'), range, type, instruction,
                questions: parseGenericNumberedQuestions(bodyText, 'radio'),
                sharedOptions: [], wordLimit: '', paragraphRange: '', rawText: block, confidence: 0.87
            };
        }

        function parseCompletion(block, type = 'summary_completion') {
            const range = extractRange(block);
            const { instruction, bodyText } = splitInstructionAndBody(block);
            const wordLimit = extractWordLimit(instruction + '\n' + bodyText);
            const questions = [];
            const lines = String(bodyText || '').split('\n').map(l => l.trim()).filter(Boolean);
            const blankReg = /(\d{1,2})\s*(?:_{2,}|\.{3,}|-{2,}|\[[^\]]*blank[^\]]*\])/ig;
            for (const line of lines) {
                let found = false;
                let m;
                blankReg.lastIndex = 0;
                while ((m = blankReg.exec(line)) !== null) {
                    found = true;
                    const id = m[1];
                    const stem = line.replace(new RegExp(`${id}\\s*(?:_{2,}|\\.{3,}|-{2,}|\\[[^\\]]*blank[^\\]]*\\])`, 'i'), '[blank]');
                    questions.push(createQuestion(id, stem, { answerInputType: 'text' }));
                }
                if (!found) {
                    const numbered = line.match(/^\s*(\d{1,2})[\.\)]\s+(.+)$/);
                    if (numbered) questions.push(createQuestion(numbered[1], numbered[2], { answerInputType: 'text' }));
                }
            }
            return {
                id: uid('group'), range, type, instruction,
                questions, sharedOptions: [], wordLimit, paragraphRange: '', rawText: block, confidence: questions.length ? 0.8 : 0.4
            };
        }

        function parseUnknown(block) {
            const range = extractRange(block);
            const { instruction, bodyText } = splitInstructionAndBody(block);
            return {
                id: uid('group'), range, type: 'unknown', instruction,
                questions: parseGenericNumberedQuestions(bodyText, 'unknown'),
                sharedOptions: [], wordLimit: '', paragraphRange: '', rawText: block, confidence: 0.25
            };
        }

        function parseQuestionGroup(block, index = 0) {
            const { instruction, bodyText } = splitInstructionAndBody(block);
            const detected = detectQuestionType(instruction, bodyText || block);
            if (detected === 'matching_headings') return parseMatchingHeadings(block);
            if (detected === 'matching_information') return parseMatchingInformation(block);
            if (detected === 'matching_features') return parseMatchingListType(block, 'matching_features');
            if (detected === 'matching_sentence_endings') return parseMatchingListType(block, 'matching_sentence_endings');
            if (detected === 'multiple_choice') return parseMultipleChoice(block, false);
            if (detected === 'multiple_choice_multi') return parseMultipleChoice(block, true);
            if (detected === 'true_false_not_given') return parseTFNG(block, 'true_false_not_given');
            if (detected === 'yes_no_not_given') return parseTFNG(block, 'yes_no_not_given');
            if (['summary_completion', 'sentence_completion', 'short_answer', 'table_completion', 'flow_chart_completion', 'diagram_label_completion'].includes(detected)) return parseCompletion(block, detected);
            return parseUnknown(block);
        }

        function parseQuestionsEngine(rawText) {
            const cleanText = cleanQuestionText(rawText);
            const blocks = splitQuestionGroups(cleanText);
            return blocks.map((block, index) => parseQuestionGroup(block, index));
        }

        function renderReviewEditor() {
            const container = document.getElementById('review-container');
            container.innerHTML = '';

            const topBar = document.createElement('div');
            topBar.className = 'mb-4 flex gap-2 justify-between items-center';
            topBar.innerHTML = `
                <div class="text-xs text-slate-500">校对重点：先确认题型，再确认题号、选项池和填空位置。低置信度题组会标橙色。</div>
                <button onclick="addQuestionGroup()" class="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg font-semibold">+ 增加题组</button>
            `;
            container.appendChild(topBar);

            parsedQuestionGroups.forEach((group, gIndex) => {
                const card = document.createElement('div');
                card.className = 'review-card';
                const lowConfidence = (group.confidence ?? 1) < 0.6;
                const typeSelectHTML = QUESTION_TYPES.map(([val, label]) => `<option value="${val}" ${group.type === val ? 'selected' : ''}>${label}</option>`).join('');
                const sharedOptionsText = (group.sharedOptions || []).map(o => `${o.label}. ${o.text}`).join('\n');

                const questionsHTML = (group.questions || []).map((q, qIndex) => {
                    const optionsText = (q.options || []).map(o => `${o.label}. ${o.text}`).join('\n');
                    const needsOptions = ['multiple_choice', 'multiple_choice_multi'].includes(group.type);
                    return `
                        <div class="review-subcard">
                            <div class="flex gap-2 items-start">
                                <input type="number" class="w-16 p-1.5 border border-slate-300 rounded text-center text-sm font-bold bg-white" value="${escapeHTML(q.id)}" onchange="updateQId(${gIndex}, ${qIndex}, this.value)">
                                <input type="text" class="w-32 p-1.5 border border-slate-300 rounded text-sm bg-white" placeholder="target" value="${escapeHTML(q.target || '')}" onchange="updateQTarget(${gIndex}, ${qIndex}, this.value)">
                                <select class="w-28 p-1.5 border border-slate-300 rounded text-xs bg-white" onchange="updateQInputType(${gIndex}, ${qIndex}, this.value)">
                                    ${['radio','checkbox','select','text','drag','unknown'].map(t => `<option value="${t}" ${q.answerInputType === t ? 'selected' : ''}>${t}</option>`).join('')}
                                </select>
                                <button onclick="moveQuestion(${gIndex}, ${qIndex}, -1)" class="px-2 py-1 text-xs bg-slate-100 rounded">↑</button>
                                <button onclick="moveQuestion(${gIndex}, ${qIndex}, 1)" class="px-2 py-1 text-xs bg-slate-100 rounded">↓</button>
                                <button onclick="deleteQuestion(${gIndex}, ${qIndex})" class="text-red-500 px-2 py-1 bg-red-50 rounded text-xs">删除</button>
                            </div>
                            <textarea class="w-full mt-2 p-2 border border-slate-300 rounded text-sm resize-y bg-white" rows="2" placeholder="题干 / stem" onchange="updateQStem(${gIndex}, ${qIndex}, this.value)">${escapeHTML(q.stem || '')}</textarea>
                            ${needsOptions ? `<textarea class="w-full mt-2 p-2 border border-blue-200 bg-blue-50/30 rounded text-sm resize-y" rows="3" placeholder="选项区，每行一个选项，例如：A. ..." onchange="updateQOptions(${gIndex}, ${qIndex}, this.value)">${escapeHTML(optionsText)}</textarea>` : ''}
                        </div>
                    `;
                }).join('');

                const headingEditor = group.type === 'matching_headings' ? `
                    <div class="review-subcard">
                        <label class="text-xs text-slate-500 font-bold mb-1 block">List of Headings 选项池，每行一个：i. heading text</label>
                        <textarea class="w-full p-2 border border-amber-200 bg-amber-50/30 rounded text-sm resize-y" rows="5" onchange="updateSharedOptions(${gIndex}, this.value)">${escapeHTML(sharedOptionsText)}</textarea>
                    </div>
                ` : '';

                card.innerHTML = `
                    <div class="flex items-center justify-between gap-3 mb-3 border-b border-slate-100 pb-2">
                        <div class="flex items-center gap-2 flex-wrap">
                            <input type="text" class="font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded outline-none border-b border-transparent focus:border-indigo-400" value="${escapeHTML(group.range)}" onchange="updateGroupRange(${gIndex}, this.value)">
                            ${lowConfidence ? '<span class="status-pill warning">低置信度，建议人工检查</span>' : '<span class="status-pill completed">已结构化</span>'}
                        </div>
                        <div class="flex items-center gap-2">
                            <select class="text-sm border border-slate-300 rounded p-1 outline-none focus:border-indigo-500 bg-slate-50" onchange="updateGroupType(${gIndex}, this.value)">${typeSelectHTML}</select>
                            <button onclick="deleteGroup(${gIndex})" class="text-red-500 text-sm hover:underline">删除题组</button>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                            <label class="text-xs text-slate-500 font-bold mb-1 block">Word Limit</label>
                            <input type="text" class="w-full p-2 border border-slate-300 rounded text-sm" placeholder="ONE WORD ONLY" value="${escapeHTML(group.wordLimit || '')}" onchange="updateGroupWordLimit(${gIndex}, this.value)">
                        </div>
                        <div>
                            <label class="text-xs text-slate-500 font-bold mb-1 block">Paragraph Range</label>
                            <input type="text" class="w-full p-2 border border-slate-300 rounded text-sm" placeholder="A-G" value="${escapeHTML(group.paragraphRange || '')}" onchange="updateGroupParagraphRange(${gIndex}, this.value)">
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="text-xs text-slate-500 font-bold mb-1 block">Instruction 题目要求</label>
                        <textarea class="w-full p-2 border border-slate-300 rounded text-sm text-slate-700 resize-y outline-none focus:border-indigo-500" rows="2" onchange="updateGroupInst(${gIndex}, this.value)">${escapeHTML(group.instruction || '')}</textarea>
                    </div>
                    ${headingEditor}
                    <div class="pl-2 border-l-2 border-slate-200">
                        <div class="flex justify-between items-center mb-1">
                            <label class="text-xs text-slate-500 font-bold block">Questions 拆分检查</label>
                            <button onclick="addQuestion(${gIndex})" class="px-2 py-1 bg-slate-800 text-white text-xs rounded">+ 增加题目</button>
                        </div>
                        ${questionsHTML || '<div class="text-xs text-orange-600 bg-orange-50 p-3 rounded-lg">未识别到题目，请手动增加题目。</div>'}
                    </div>
                    ${group.type === 'unknown' ? `<div class="review-subcard"><label class="text-xs text-slate-500 font-bold mb-1 block">原始文本兜底</label><textarea class="w-full p-2 border border-slate-300 rounded text-xs" rows="5" onchange="updateGroupRawText(${gIndex}, this.value)">${escapeHTML(group.rawText || '')}</textarea></div>` : ''}
                `;
                container.appendChild(card);
            });
        }

        function parseOptionsFromTextarea(val, roman = false) {
            return String(val || '').split('\n').map(line => line.trim()).filter(Boolean).map((line, idx) => {
                const match = line.match(/^([A-F]|i{1,3}|iv|v|vi{1,3}|ix|x|xi{1,3}|xiv|xv)[\.\)]?\s+(.+)$/i);
                if (match) return { label: roman ? match[1].toLowerCase() : match[1].toUpperCase(), text: normalizeSpaces(match[2]) };
                return { label: roman ? String(idx + 1) : String.fromCharCode(65 + idx), text: line };
            });
        }

        function updateGroupRange(gId, val) { parsedQuestionGroups[gId].range = val; }
        function updateGroupInst(gId, val) { parsedQuestionGroups[gId].instruction = val; }
        function updateGroupWordLimit(gId, val) { parsedQuestionGroups[gId].wordLimit = val; }
        function updateGroupParagraphRange(gId, val) { parsedQuestionGroups[gId].paragraphRange = val; }
        function updateGroupRawText(gId, val) { parsedQuestionGroups[gId].rawText = val; }
        function updateSharedOptions(gId, val) { parsedQuestionGroups[gId].sharedOptions = parseOptionsFromTextarea(val, true); }
        function updateGroupType(gId, val) {
            const group = parsedQuestionGroups[gId];
            group.type = val;
            group.confidence = Math.max(group.confidence || 0.4, 0.7);
            if (val === 'matching_headings') {
                group.sharedOptions = group.sharedOptions || [];
                group.questions.forEach(q => { q.answerInputType = 'select'; q.target = q.target || q.stem; });
            }
            if (val === 'matching_information') {
                group.paragraphRange = group.paragraphRange || 'A-G';
                group.questions.forEach(q => q.answerInputType = 'select');
            }
            if (val === 'multiple_choice') group.questions.forEach(q => q.answerInputType = 'radio');
            if (val === 'multiple_choice_multi') group.questions.forEach(q => q.answerInputType = 'checkbox');
            if (val.includes('completion') || val === 'short_answer') group.questions.forEach(q => q.answerInputType = 'text');
            renderReviewEditor();
        }
        function updateQId(gId, qId, val) { parsedQuestionGroups[gId].questions[qId].id = Number(val); }
        function updateQStem(gId, qId, val) { parsedQuestionGroups[gId].questions[qId].stem = val; }
        function updateQTarget(gId, qId, val) { parsedQuestionGroups[gId].questions[qId].target = val; }
        function updateQInputType(gId, qId, val) { parsedQuestionGroups[gId].questions[qId].answerInputType = val; }
        function updateQOptions(gId, qId, val) { parsedQuestionGroups[gId].questions[qId].options = parseOptionsFromTextarea(val, false); }
        function addQuestion(gId) {
            const group = parsedQuestionGroups[gId];
            const maxId = group.questions.reduce((m, q) => Math.max(m, Number(q.id) || 0), 0);
            const inputType = group.type === 'multiple_choice_multi' ? 'checkbox' : group.type === 'multiple_choice' ? 'radio' : (group.type.includes('completion') || group.type === 'short_answer') ? 'text' : 'select';
            group.questions.push(createQuestion(maxId + 1 || 1, '', { answerInputType: inputType }));
            renderReviewEditor();
        }
        function addQuestionGroup() {
            parsedQuestionGroups.push({ id: uid('group'), range: 'Questions ?', type: 'unknown', instruction: '', questions: [], sharedOptions: [], wordLimit: '', paragraphRange: '', rawText: '', confidence: 0.2 });
            renderReviewEditor();
        }
        function deleteQuestion(gId, qId) { parsedQuestionGroups[gId].questions.splice(qId, 1); renderReviewEditor(); }
        function deleteGroup(gId) { parsedQuestionGroups.splice(gId, 1); renderReviewEditor(); }
        function moveQuestion(gId, qId, dir) {
            const arr = parsedQuestionGroups[gId].questions;
            const next = qId + dir;
            if (next < 0 || next >= arr.length) return;
            [arr[qId], arr[next]] = [arr[next], arr[qId]];
            renderReviewEditor();
        }

        function processToReview() {
            let passage = document.getElementById('input-passage').value.trim();
            if (passage) {
                passageWorkspace.innerHTML = passage
                    .replace(/\n\s*\n/g, '\n')
                    .split('\n')
                    .filter(p => p.trim())
                    .map(p => `<p>${escapeHTML(p)}</p>`)
                    .join('');
            }
            const rawQuestions = document.getElementById('input-questions').value.trim();
            if (rawQuestions) {
                parsedQuestionGroups = parseQuestionsEngine(rawQuestions);
                renderReviewEditor();
                document.getElementById('step-1-input').classList.add('hidden');
                document.getElementById('step-2-review').classList.remove('hidden');
            } else {
                alert('请在右侧粘贴题干文本！');
            }
        }

        function getQuestion(groupId, questionId) {
            const group = parsedQuestionGroups.find(g => g.id === groupId);
            if (!group) return null;
            return group.questions.find(q => Number(q.id) === Number(questionId)) || null;
        }

        function ensureEvidenceBinding(question) {
            question.evidenceBindings = question.evidenceBindings || [];
            if (!question.evidenceBindings[0]) {
                question.evidenceBindings[0] = {
                    questionId: question.id,
                    questionKeywords: [],
                    paraphrasePairs: [],
                    eliminationReasons: []
                };
            }
            return question.evidenceBindings[0];
        }

        function updateQuestionStatus(groupId, questionId) {
            const q = getQuestion(groupId, questionId);
            if (!q) return;
            const hasAnswer = Array.isArray(q.userAnswer) ? q.userAnswer.length > 0 : !!String(q.userAnswer || '').trim();
            if (!hasAnswer) { q.status = 'not_started'; return; }
            const b = q.evidenceBindings?.[0];
            if (!b?.passageEvidence?.text) { q.status = 'evidence_missing'; return; }
            if (!b.questionKeywords || b.questionKeywords.length === 0) { q.status = 'keywords_missing'; return; }
            if (!b.paraphrasePairs || b.paraphrasePairs.length === 0) { q.status = 'paraphrase_missing'; return; }
            if (!b.eliminationReasons || b.eliminationReasons.length === 0 || !b.eliminationReasons.some(r => String(r.reason || '').trim())) { q.status = 'elimination_missing'; return; }
            q.status = 'completed';
        }

        function updateUserAnswer(groupId, questionId, answer) {
            const q = getQuestion(groupId, questionId);
            if (!q) return;
            q.userAnswer = answer;
            setActiveQuestion(groupId, questionId, false);
            updateQuestionStatus(groupId, questionId);
            updateEvidenceChecklistUI(groupId, questionId);
            saveCurrentProject();
        }

        function updateMultiUserAnswer(groupId, questionId) {
            const checked = Array.from(document.querySelectorAll(`input[data-group-id="${groupId}"][data-question-id="${questionId}"]:checked`)).map(el => el.value);
            updateUserAnswer(groupId, questionId, checked);
        }

        function setActiveQuestion(groupId, questionId, rerender = false) {
            activeGroupId = groupId;
            activeQuestionId = Number(questionId);
            document.querySelectorAll('.cbt-question-card').forEach(el => el.classList.remove('active-question'));
            const card = document.querySelector(`[data-q-card="${groupId}_${questionId}"]`);
            if (card) card.classList.add('active-question');
            if (rerender) confirmAndRenderCBT(false);
        }

        function bindSelectedPassageEvidence(groupId = activeGroupId, questionId = activeQuestionId) {
            const selection = window.getSelection().toString().trim();
            if (!selection || !groupId || !questionId) { alert('请先选中原文证据，并点击对应题目。'); return; }
            const q = getQuestion(groupId, questionId);
            if (!q) return;
            const b = ensureEvidenceBinding(q);
            b.passageEvidence = { text: selection };
            updateQuestionStatus(groupId, questionId);
            updateEvidenceChecklistUI(groupId, questionId);
            saveCurrentProject();
        }

        function bindSelectedQuestionKeyword(groupId = activeGroupId, questionId = activeQuestionId) {
            const selection = window.getSelection().toString().trim();
            if (!selection || !groupId || !questionId) { alert('请先选中题干关键词，并点击对应题目。'); return; }
            const q = getQuestion(groupId, questionId);
            if (!q) return;
            const b = ensureEvidenceBinding(q);
            if (!b.questionKeywords.includes(selection)) b.questionKeywords.push(selection);
            updateQuestionStatus(groupId, questionId);
            updateEvidenceChecklistUI(groupId, questionId);
            saveCurrentProject();
        }

        function addParaphrasePair(groupId, questionId) {
            const qExp = document.getElementById(`para_q_${groupId}_${questionId}`)?.value.trim();
            const pExp = document.getElementById(`para_p_${groupId}_${questionId}`)?.value.trim();
            const relation = document.getElementById(`para_rel_${groupId}_${questionId}`)?.value || 'same_meaning';
            if (!qExp || !pExp) { alert('请填写题干表达和原文表达。'); return; }
            const q = getQuestion(groupId, questionId);
            const b = ensureEvidenceBinding(q);
            b.paraphrasePairs.push({ questionExpression: qExp, passageExpression: pExp, relation });
            document.getElementById(`para_q_${groupId}_${questionId}`).value = '';
            document.getElementById(`para_p_${groupId}_${questionId}`).value = '';
            updateQuestionStatus(groupId, questionId);
            updateEvidenceChecklistUI(groupId, questionId);
            saveCurrentProject();
        }

        function updateEliminationReason(groupId, questionId, value) {
            const q = getQuestion(groupId, questionId);
            if (!q) return;
            const b = ensureEvidenceBinding(q);
            b.eliminationReasons = [{ reason: value }];
            updateQuestionStatus(groupId, questionId);
            updateEvidenceChecklistUI(groupId, questionId);
            saveCurrentProject();
        }

        function evidenceState(question) {
            const b = question.evidenceBindings?.[0];
            const hasAnswer = Array.isArray(question.userAnswer) ? question.userAnswer.length > 0 : !!String(question.userAnswer || '').trim();
            return {
                answer: hasAnswer,
                evidence: !!b?.passageEvidence?.text,
                keywords: !!b?.questionKeywords?.length,
                paraphrase: !!b?.paraphrasePairs?.length,
                elimination: !!b?.eliminationReasons?.some(r => String(r.reason || '').trim())
            };
        }

        function renderEvidenceChecklist(group, question) {
            const state = evidenceState(question);
            const item = (key, label) => `<div class="evidence-check-item ${state[key] ? 'done' : ''}" data-check="${key}">${state[key] ? '✓' : '□'} ${label}</div>`;
            return `
                <div class="evidence-checklist" data-checklist="${group.id}_${question.id}">
                    ${item('answer', '已选择答案')}
                    ${item('evidence', '已绑定原文证据')}
                    ${item('keywords', '已标记题干关键词')}
                    ${item('paraphrase', '已建立同义替换')}
                    ${item('elimination', '已填写排除理由')}
                </div>
            `;
        }

        function updateEvidenceChecklistUI(groupId, questionId) {
            const q = getQuestion(groupId, questionId);
            if (!q) return;
            const state = evidenceState(q);
            const box = document.querySelector(`[data-checklist="${groupId}_${questionId}"]`);
            if (box) {
                box.querySelectorAll('[data-check]').forEach(el => {
                    const key = el.dataset.check;
                    el.classList.toggle('done', !!state[key]);
                    el.innerHTML = `${state[key] ? '✓' : '□'} ${el.textContent.replace(/^✓\s|^□\s/, '')}`;
                });
            }
            const card = document.querySelector(`[data-q-card="${groupId}_${questionId}"]`);
            if (card) card.classList.toggle('completed', q.status === 'completed');
            const pill = document.querySelector(`[data-status-pill="${groupId}_${questionId}"]`);
            if (pill) {
                pill.textContent = statusText(q.status);
                pill.className = `status-pill ${q.status === 'completed' ? 'completed' : q.status === 'not_started' ? '' : 'warning'}`;
            }
        }

        function statusText(status) {
            const map = {
                not_started: '未开始', answer_selected: '已作答', evidence_missing: '缺原文证据',
                keywords_missing: '缺题干关键词', paraphrase_missing: '缺同义替换', elimination_missing: '缺排除理由', completed: '证据链完成'
            };
            return map[status] || '未开始';
        }

        function renderQuestionControls(group, q) {
            const gid = group.id;
            const qid = q.id;
            const selected = q.userAnswer;
            const commonAttrs = `data-group-id="${gid}" data-question-id="${qid}"`;
            if (q.answerInputType === 'radio' && ['true_false_not_given', 'yes_no_not_given'].includes(group.type)) {
                const labels = group.type === 'true_false_not_given' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN'];
                return `<div class="cbt-tfng-group">${labels.map(label => `<button class="cbt-tfng-btn ${selected === label ? 'active' : ''}" onclick="updateUserAnswer('${gid}', ${qid}, '${label}')">${label}</button>`).join('')}</div>`;
            }
            if (q.answerInputType === 'radio') {
                return `<div class="cbt-options">${(q.options || []).map(opt => `<label class="cbt-radio-label"><input type="radio" name="q_${gid}_${qid}" value="${escapeHTML(opt.label)}" ${selected === opt.label ? 'checked' : ''} onchange="updateUserAnswer('${gid}', ${qid}, this.value)"><span><b>${escapeHTML(opt.label)}</b> ${escapeHTML(opt.text)}</span></label>`).join('')}</div>`;
            }
            if (q.answerInputType === 'checkbox') {
                const values = Array.isArray(selected) ? selected : [];
                return `<div class="cbt-options">${(q.options || []).map(opt => `<label class="cbt-radio-label"><input type="checkbox" ${commonAttrs} value="${escapeHTML(opt.label)}" ${values.includes(opt.label) ? 'checked' : ''} onchange="updateMultiUserAnswer('${gid}', ${qid})"><span><b>${escapeHTML(opt.label)}</b> ${escapeHTML(opt.text)}</span></label>`).join('')}</div>`;
            }
            if (q.answerInputType === 'select') {
                const opts = group.type === 'matching_headings'
                    ? (group.sharedOptions || []).map(o => `<option value="${escapeHTML(o.label)}" ${selected === o.label ? 'selected' : ''}>${escapeHTML(o.label)}. ${escapeHTML(o.text)}</option>`).join('')
                    : paragraphLetters(group.paragraphRange || 'A-G').map(letter => `<option value="${letter}" ${selected === letter ? 'selected' : ''}>${letter}</option>`).join('');
                return `<select class="cbt-select" onchange="updateUserAnswer('${gid}', ${qid}, this.value)"><option value="">Select...</option>${opts}</select>`;
            }
            if (q.answerInputType === 'text') {
                return `<input type="text" class="cbt-input" data-question-id="${qid}" value="${escapeHTML(selected || '')}" placeholder="Type answer" oninput="updateUserAnswer('${gid}', ${qid}, this.value)">`;
            }
            return `<span class="text-xs text-orange-600">未知交互，请在校对台设置 answerInputType</span>`;
        }

        function renderStemWithBlank(group, q) {
            const stem = escapeHTML(q.stem || '');
            const input = renderQuestionControls(group, q);
            if (stem.includes('[blank]')) return stem.replace('[blank]', input);
            return `${stem} ${input}`;
        }

        function renderEvidenceTools(group, q) {
            const b = q.evidenceBindings?.[0] || {};
            const elimination = b.eliminationReasons?.[0]?.reason || '';
            return `
                ${renderEvidenceChecklist(group, q)}
                <div class="evidence-actions">
                    <button class="evidence-btn" onclick="setActiveQuestion('${group.id}', ${q.id}); bindSelectedPassageEvidence('${group.id}', ${q.id})">绑定选中文本为原文证据</button>
                    <button class="evidence-btn" onclick="setActiveQuestion('${group.id}', ${q.id}); bindSelectedQuestionKeyword('${group.id}', ${q.id})">标记选中文本为题干关键词</button>
                    <input id="para_q_${group.id}_${q.id}" class="evidence-mini-input" placeholder="题干表达">
                    <input id="para_p_${group.id}_${q.id}" class="evidence-mini-input" placeholder="原文表达">
                    <select id="para_rel_${group.id}_${q.id}" class="evidence-mini-input">
                        <option value="same_meaning">同义替换</option>
                        <option value="cause_effect">因果</option>
                        <option value="contrast">对比/转折</option>
                        <option value="example">举例</option>
                        <option value="definition">定义</option>
                        <option value="unknown">未知</option>
                    </select>
                    <button class="evidence-btn" onclick="addParaphrasePair('${group.id}', ${q.id})">添加关系</button>
                </div>
                <textarea class="elimination-box" placeholder="为什么其他选项不对？写排除理由。" oninput="updateEliminationReason('${group.id}', ${q.id}, this.value)">${escapeHTML(elimination)}</textarea>
            `;
        }

        function renderQuestionCard(group, q) {
            updateQuestionStatus(group.id, q.id);
            const isCompletion = q.answerInputType === 'text';
            let main = '';
            if (isCompletion) {
                main = `<div class="cbt-question-text-wrapper"><span class="cbt-qnum">${escapeHTML(q.id)}</span><span>${renderStemWithBlank(group, q)}</span></div>`;
            } else {
                main = `<div class="cbt-question-text-wrapper"><span class="cbt-qnum">${escapeHTML(q.id)}</span><span>${escapeHTML(q.target || q.stem)}</span>${['select'].includes(q.answerInputType) ? renderQuestionControls(group, q) : ''}</div>`;
                if (!['select'].includes(q.answerInputType)) main += renderQuestionControls(group, q);
            }
            return `
                <div class="cbt-question-card ${q.status === 'completed' ? 'completed' : ''}" data-q-card="${group.id}_${q.id}" onclick="setActiveQuestion('${group.id}', ${q.id})">
                    <div class="flex justify-between items-start gap-3">
                        <div class="cbt-question flex-1">${main}</div>
                        <span class="status-pill ${q.status === 'completed' ? 'completed' : q.status === 'not_started' ? '' : 'warning'}" data-status-pill="${group.id}_${q.id}">${statusText(q.status)}</span>
                    </div>
                    ${renderEvidenceTools(group, q)}
                </div>
            `;
        }

        function confirmAndRenderCBT(shouldClose = true) {
            let finalHTML = '';
            parsedQuestionGroups.forEach(group => {
                let groupHTML = `<div class="cbt-group" id="${escapeHTML(group.id)}">`;
                if (group.range) groupHTML += `<div class="cbt-header">${escapeHTML(group.range)}</div>`;
                if (group.instruction) {
                    let instStr = escapeHTML(group.instruction).replace(/(TRUE|FALSE|NOT GIVEN|YES|NO|ONE WORD ONLY|NO MORE THAN (?:ONE|TWO|THREE|FOUR|\d+) WORDS?(?: AND\/OR A NUMBER)?)/gi, '<b>$1</b>');
                    groupHTML += `<div class="cbt-instruction">${instStr}${group.wordLimit ? `<div class="mt-2 text-indigo-700">Word limit: <b>${escapeHTML(group.wordLimit)}</b></div>` : ''}</div>`;
                }
                if (group.questions?.length) groupHTML += group.questions.map(q => renderQuestionCard(group, q)).join('');
                else groupHTML += `<div class="text-sm text-orange-600 bg-orange-50 border border-orange-100 p-4 rounded-lg">该题组没有识别到题目，请返回校对台手动补充。</div>`;
                if (group.type === 'matching_headings' && group.sharedOptions?.length) {
                    groupHTML += `<div class="cbt-shared-options"><div class="font-bold text-slate-700 mb-2">List of Headings</div>${group.sharedOptions.map(o => `<div class="cbt-heading-option"><span class="cbt-heading-option-label">${escapeHTML(o.label)}</span><span>${escapeHTML(o.text)}</span></div>`).join('')}</div>`;
                }
                if (group.type === 'unknown' && group.rawText) {
                    groupHTML += `<pre class="mt-4 text-xs whitespace-pre-wrap bg-orange-50 border border-orange-100 p-3 rounded-lg text-orange-800">${escapeHTML(group.rawText)}</pre>`;
                }
                groupHTML += `</div>`;
                finalHTML += groupHTML;
            });
            questionsWorkspace.innerHTML = finalHTML;
            clearAllLines();
            saveCurrentProject();
            if (shouldClose) closeInputModal();
        }

        function saveCurrentProject() {
            try {
                const project = {
                    id: currentProjectId,
                    cloudProjectId: currentCloudProjectId,
                    updatedAt: new Date().toISOString(),
                    ...collectCurrentAppState()
                };
                localStorage.setItem('ieltsCurrentProject', JSON.stringify(project));
            } catch (e) { console.warn('保存失败', e); }
        }

        function loadCurrentProject() {
            try {
                const saved = localStorage.getItem('ieltsCurrentProject');
                if (!saved) return;
                const project = JSON.parse(saved);
                if (project.cloudProjectId) currentCloudProjectId = project.cloudProjectId;
                restoreAppState(project);
            } catch (e) { console.warn('加载历史项目失败', e); }
        }

        window.addEventListener('DOMContentLoaded', () => {
            setTimeout(loadCurrentProject, 50);
        });

        /* --- 基础逻辑维持原样 --- */

        document.addEventListener('mouseover', e => { const chunk = e.target.closest('.chunk'); if (chunk) hoveredChunk = chunk; });
        document.addEventListener('mouseout', e => { const chunk = e.target.closest('.chunk'); if (chunk && hoveredChunk === chunk) hoveredChunk = null; });
        const tagMap = { '1': '观点', '2': '背景', '3': '证据', '4': '举例', '5': '对比', '6': '原因', '7': '结果', '8': '限定', '9': '结论', 'p': '同义替换' };

        document.addEventListener('keydown', (e) => {
            const activeTag = document.activeElement.tagName;
            
            const lineModal = document.getElementById('line-label-modal');
            if (lineModal && !lineModal.classList.contains('hidden')) {
                if (activeTag === 'INPUT') { if (e.key === 'Enter') applyCustomLineLabel(); return; }
                const lineKeys = { '1': '支撑', '2': '对比/转折', '3': '导致', '4': '举例', '5': '定义', '6': '限定', '7': '同义改写', '8': '答案证据' };
                if (lineKeys[e.key]) { e.preventDefault(); applyLineLabel(lineKeys[e.key]); } else if (e.key === 'Escape') closeLineLabelModal();
                return; 
            }

            const chunkModal = document.getElementById('chunk-label-modal');
            if (chunkModal && !chunkModal.classList.contains('hidden')) {
                const keyLower = e.key.toLowerCase();
                if (tagMap[keyLower]) { e.preventDefault(); applyChunkLabel(tagMap[keyLower]); } 
                else if (e.key === 'Escape') closeChunkLabelModal();
                return;
            }

            if (activeTag === 'TEXTAREA' || activeTag === 'INPUT') return;

            const selection = window.getSelection();
            const text = selection.toString().trim();
            const key = e.key.toLowerCase();

            if (key === 'w' && text) {
                e.preventDefault();
                document.getElementById('vocab-target').value = text;
                showModal('vocab-modal');
                fetchVocabTranslation(text);
                return;
            }

            if (['a', 's'].includes(key) && text) {
                e.preventDefault();
                createChunk(selection, key === 'a' ? 'core' : 'mod');
                return;
            }

            // D：打开词块标签面板。原 C 快捷键已迁移到 D；逻辑连线标签快捷键已取消。
            if (key === 'd') {
                const targetChunk = hoveredChunk || lastCreatedChunk;
                if (targetChunk) {
                    e.preventDefault();
                    openChunkLabelModal(targetChunk);
                }
                return;
            }
        });

        function createChunk(selection, type) {
            const range = selection.getRangeAt(0);
            const span = document.createElement('span');
            span.className = `chunk chunk-${type}`;
            span.id = `chunk-${chunkIdCounter++}`;
            span.dataset.type = type;
            try {
                range.surroundContents(span);
            } catch (error) {}
            selection.removeAllRanges();
            lastCreatedChunk = span;
            saveCurrentProject();
            return span; 
        }

        // 全局词块事件代理：保证从 localStorage / 云端恢复的 chunk 仍然可以点击、双击。
        document.addEventListener('click', (e) => {
            const chunk = e.target.closest('.chunk');
            if (!chunk || (!passageWorkspace.contains(chunk) && !questionsWorkspace.contains(chunk))) return;
            handleChunkClick({ currentTarget: chunk, shiftKey: e.shiftKey, stopPropagation: () => e.stopPropagation() });
        });
        document.addEventListener('dblclick', (e) => {
            const chunk = e.target.closest('.chunk');
            if (!chunk || (!passageWorkspace.contains(chunk) && !questionsWorkspace.contains(chunk))) return;
            handleChunkDblClick({ currentTarget: chunk, stopPropagation: () => e.stopPropagation() });
        });

        function handleChunkClick(e) {
            if (!e.shiftKey) return; 
            e.stopPropagation();
            const clickedChunk = e.currentTarget;
            if (!selectedChunkForLine) {
                selectedChunkForLine = clickedChunk;
                clickedChunk.classList.add('selected-for-line');
            } else {
                if (selectedChunkForLine !== clickedChunk) drawLine(selectedChunkForLine, clickedChunk);
                selectedChunkForLine.classList.remove('selected-for-line');
                selectedChunkForLine = null;
            }
        }

        function drawLine(startEl, endEl, shouldSave = true) {
            const type = startEl.dataset.type;
            const startInLeft = leftPanel.contains(startEl);
            const endInLeft = leftPanel.contains(endEl);
            const isCrossPanel = startInLeft !== endInLeft;
            let options = {
                color: type === 'mod' ? 'rgba(101, 132, 111, 0.50)' : 'rgba(147, 88, 102, 0.54)', 
                size: 2, path: isCrossPanel ? 'grid' : 'fluid', 
                startSocket: isCrossPanel ? (startInLeft ? 'right' : 'left') : 'bottom',
                endSocket: isCrossPanel ? (endInLeft ? 'right' : 'left') : 'bottom',
                hide: true, dash: { len: 5, gap: 5 }
            };
            const lineId = 'line-' + Date.now() + Math.floor(Math.random() * 1000);
            const line = new LeaderLine(startEl, endEl, options);
            lines.push({ id: lineId, line, startEl, endEl, label: '' });
            line.show('draw'); 
            setTimeout(() => {
                document.querySelectorAll('.leader-line:not([id])').forEach(svg => {
                    svg.id = lineId; svg.style.zIndex = '15'; svg.style.pointerEvents = 'none'; 
                });
            }, 150);
            if (shouldSave) saveCurrentProject();
            return lineId;
        }

        function handleChunkDblClick(e) {
            const chunk = e.currentTarget;
            lines = lines.filter(item => { if (item.startEl === chunk || item.endEl === chunk) { item.line.remove(); return false; } return true; });
            const textNode = document.createTextNode(chunk.textContent);
            chunk.parentNode.replaceChild(textNode, chunk);
            hoveredChunk = null;
            saveCurrentProject();
        }

        let resizeTimer;
        function updateLinesThrottled() {
            if(resizeTimer) cancelAnimationFrame(resizeTimer);
            resizeTimer = requestAnimationFrame(() => { lines.forEach(item => { try { item.line.position(); } catch(e){} }); });
        }
        window.addEventListener('resize', updateLinesThrottled);
        
        function clearAllLines(shouldSave = true) {
            lines.forEach(item => item.line.remove());
            lines = [];
            if (selectedChunkForLine) { selectedChunkForLine.classList.remove('selected-for-line'); selectedChunkForLine = null; }
            if (shouldSave) saveCurrentProject();
        }

        function openLineLabelModal(id) { activeLineId = id; showModal('line-label-modal'); document.getElementById('custom-line-label').value = ''; setTimeout(() => document.getElementById('custom-line-label').focus(), 100); }
        function findLinesByChunk(chunk) { return lines.filter(item => item.startEl === chunk || item.endEl === chunk); }
        function closeLineLabelModal() { hideModal('line-label-modal'); activeLineId = null; }

        const lineColorsMap = {
            '支撑': 'rgba(124, 127, 156, 0.58)', '对比/转折': 'rgba(147, 88, 102, 0.58)', 
            '导致': 'rgba(142, 126, 154, 0.56)', '举例': 'rgba(101, 132, 111, 0.56)',      
            '定义': 'rgba(168, 148, 120, 0.56)', '限定': 'rgba(129, 132, 134, 0.54)',      
            '同义改写': 'rgba(159, 119, 132, 0.58)', '答案证据': 'rgba(104, 133, 142, 0.58)'   
        };

        function applyLineLabel(label) {
            if (!activeLineId) return;
            const lineObj = lines.find(l => l.id === activeLineId);
            if (lineObj && lineObj.line) {
                const newColor = lineColorsMap[label] || 'rgba(142, 158, 171, 0.6)';
                const labelEl = document.createElement('div');
                labelEl.className = 'capsule-label'; labelEl.textContent = label; labelEl.style.display = 'inline-block'; labelEl.style.zIndex = '50';
                lineObj.label = label;
                lineObj.line.setOptions({ middleLabel: labelEl, color: newColor, dash: { len: 5, gap: 5 } });
                saveCurrentProject();
            }
            closeLineLabelModal();
        }
        function applyCustomLineLabel() { const val = document.getElementById('custom-line-label').value.trim(); if (val) applyLineLabel(val); }

        function openChunkLabelModal(chunk) { activeChunkForLabel = chunk; showModal('chunk-label-modal'); }
        function closeChunkLabelModal() { hideModal('chunk-label-modal'); activeChunkForLabel = null; }
        function applyChunkLabel(label) {
            if (!activeChunkForLabel) return;
            if (label === 'CLEAR') activeChunkForLabel.removeAttribute('data-label');
            else activeChunkForLabel.setAttribute('data-label', label);
            saveCurrentProject();
            closeChunkLabelModal();
        }
        
        let currentTranslationHtml = ""; 
        function closeVocabModal() { hideModal('vocab-modal'); }
        
        async function fetchVocabTranslation(word) {
            const resultBox = document.getElementById('vocab-translation-box');
            document.getElementById('vocab-chunks').value = ''; currentTranslationHtml = "";
            resultBox.innerHTML = `<div class="flex items-center justify-center h-full gap-2 text-morandi-primary"><svg class="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span class="text-sm font-medium">正在拉取双语释义...</span></div>`;
            try {
                const zhRes = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|zh-CN`);
                const zhData = await zhRes.json(); let zhTranslation = zhData?.responseData?.translatedText || '暂无翻译';
                const enRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
                let enDefinition = '';
                if(enRes.ok) { const enData = await enRes.json(); if(enData[0] && enData[0].meanings && enData[0].meanings[0].definitions[0]) enDefinition = enData[0].meanings[0].definitions[0].definition; }
                currentTranslationHtml = `<div class="mb-2"><strong class="text-morandi-text text-sm font-semibold inline-block mr-1">中:</strong><span class="text-[13.5px] text-gray-700">${zhTranslation}</span></div>${enDefinition ? `<div class="mt-2 pt-2 border-t border-gray-100"><strong class="text-morandi-text text-sm font-semibold inline-block mr-1">英:</strong><span class="text-[13.5px] text-gray-700 italic">${enDefinition}</span></div>` : ''}`;
                resultBox.innerHTML = currentTranslationHtml;
            } catch (error) { currentTranslationHtml = "<div class='text-red-400'>API异常，请手动添加笔记</div>"; resultBox.innerHTML = currentTranslationHtml; }
        }

        function saveAndCloseVocab() {
            const word = document.getElementById('vocab-target').value.trim(); const chunks = document.getElementById('vocab-chunks').value.trim();
            if(word) {
                const existingIndex = vocabularyList.findIndex(v => v.word.toLowerCase() === word.toLowerCase());
                const newEntry = { word: word, translationHtml: currentTranslationHtml, chunks: chunks, timestamp: Date.now() };
                if(existingIndex >= 0) { vocabularyList[existingIndex] = newEntry; } else { vocabularyList.unshift(newEntry); }
                localStorage.setItem('ieltsTrainerVocab', JSON.stringify(vocabularyList)); updateVocabBadge(); saveCurrentProject();
            }
            closeVocabModal();
        }

        function openVocabListModal() { renderVocabList(); showModal('vocab-list-modal'); }
        function closeVocabListModal() { hideModal('vocab-list-modal'); }
        function deleteVocabEntry(index) { vocabularyList.splice(index, 1); localStorage.setItem('ieltsTrainerVocab', JSON.stringify(vocabularyList)); updateVocabBadge(); renderVocabList(); saveCurrentProject(); }

        function renderVocabList() {
            const container = document.getElementById('vocab-list-container');
            if (vocabularyList.length === 0) {
                container.innerHTML = `<div class="h-full flex flex-col items-center justify-center text-morandi-subtext opacity-60"><svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg><p class="text-sm">暂无生词记录</p><p class="text-xs mt-1">在文本中选中单词并按 <kbd class="border rounded px-1 bg-gray-50 text-gray-500">W</kbd> 键即可添加</p></div>`;
                return;
            }
            container.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">` + vocabularyList.map((item, index) => `<div class="bg-gray-50 border border-gray-100 rounded-xl p-4 relative group hover:border-indigo-200 transition-colors"><div class="flex justify-between items-start mb-2"><h4 class="font-bold text-lg text-indigo-900 leading-none">${item.word}</h4><button onclick="deleteVocabEntry(${index})" class="text-gray-300 hover:text-red-500 transition-colors" title="删除生词"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button></div><div class="text-sm text-gray-600 mb-3 bg-white p-2 rounded-lg border border-gray-50 shadow-sm">${item.translationHtml || '<span class="text-gray-400 italic">暂无释义</span>'}</div>${item.chunks ? `<div class="text-xs bg-indigo-50/50 text-indigo-800 p-2 rounded border border-indigo-100/50"><span class="font-semibold">语境笔记:</span> ${item.chunks}</div>` : ''}</div>`).join('') + `</div>`;
        }

        let timerInterval = null, timeRemaining = 0;
        function handleTimerClick() { if (timerInterval) stopTimer(); else { showModal('timer-modal'); document.getElementById('timer-val-display').innerText = document.getElementById('timer-input').value; } }
        function closeTimerModal() { hideModal('timer-modal'); }
        function updateTimerValue(val) { document.getElementById('timer-val-display').innerText = val; }
        function startTimer() { timeRemaining = parseInt(document.getElementById('timer-input').value) * 60; const btn = document.getElementById('timer-btn'); btn.classList.add('text-morandi-primary', 'bg-morandi-primary/10'); updateTimerDisplay(); timerInterval = setInterval(() => { timeRemaining--; if(timeRemaining <= 0) { stopTimer(); alert("专注时间到，放松一下眼睛吧！"); } else updateTimerDisplay(); }, 1000); closeTimerModal(); }
        function stopTimer() { clearInterval(timerInterval); timerInterval = null; document.getElementById('timer-display').innerText = "番茄钟"; document.getElementById('timer-btn').classList.remove('text-morandi-primary', 'bg-morandi-primary/10'); }
        function updateTimerDisplay() { let m = Math.floor(timeRemaining / 60).toString().padStart(2, '0'); let s = (timeRemaining % 60).toString().padStart(2, '0'); document.getElementById('timer-display').innerText = `${m}:${s}`; }


/* --- Welcome screen --- */
function enterProgram() {
    const screen = document.getElementById('welcome-screen');
    if (!screen) return;
    screen.classList.add('is-leaving');
    setTimeout(() => { screen.style.display = 'none'; }, 360);
}

function openGuideFromWelcome() {
    enterProgram();
    setTimeout(() => openGuideModal(), 240);
}

function openTongzhuoSite() {
    window.open('https://ielts.itongzhuo.com/business/ielts/student/jumpSingleReport.do?sSubjects=1&sId=594&type=4', '_blank', 'noopener');
}

window.addEventListener('DOMContentLoaded', () => {
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        requestAnimationFrame(() => welcomeScreen.classList.add('is-visible'));
    }
});

window.addEventListener('beforeunload', () => { try { saveCurrentProject(); } catch(e) {} });
