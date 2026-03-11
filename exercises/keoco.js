/**
 * Pokemon Tug of War - Logic Script
 */

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTZBSB2UBklxSCr3Q-g6DyJ731csJmsh2-GyZ8ajbdTuYWFrA3KLUdS8SsbHOcENX3PnMknXP2KRpqs/pub?output=csv';

// State
let allData = [];
let topics = [];
let selectedTopic = '';
let questionCount = 15;
let gameState = 'loading'; // loading, setup, playing, winner
let winner = null;
let ropePosition = 0; // -3 to 3

let team1 = { score: 0, currentIndex: 0, questions: [], isFinished: false };
let team2 = { score: 0, currentIndex: 0, questions: [], isFinished: false };

// DOM Elements
const loadingScreen = document.getElementById('loading-screen');
const gameContainer = document.getElementById('game-container');
const topicSelect = document.getElementById('topic-select');
const countSelect = document.getElementById('count-select');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const ropeBar = document.getElementById('rope-bar');
const scoreTeam1 = document.getElementById('score-team1');
const scoreTeam2 = document.getElementById('score-team2');
const statusLine = document.getElementById('status-line');
const winnerMessage = document.getElementById('winner-message');

const team1Elements = {
    play: document.getElementById('play-team1'),
    progress: document.getElementById('progress-team1'),
    question: document.getElementById('question-team1'),
    options: document.getElementById('options-team1'),
    placeholder: document.getElementById('placeholder-team1')
};

const team2Elements = {
    play: document.getElementById('play-team2'),
    progress: document.getElementById('progress-team2'),
    question: document.getElementById('question-team2'),
    options: document.getElementById('options-team2'),
    placeholder: document.getElementById('placeholder-team2')
};

const footerRound = document.getElementById('footer-round');
const footerTopic = document.getElementById('footer-topic');

// Initialization
async function init() {
    lucide.createIcons();
    try {
        const response = await fetch(CSV_URL);
        if (!response.ok) throw new Error('Không thể tải dữ liệu');
        const csvText = await response.text();

        Papa.parse(csvText, {
            complete: (results) => {
                const data = results.data;
                if (!data || data.length < 2) {
                    showError('Dữ liệu trống hoặc không hợp lệ');
                    return;
                }

                allData = data.slice(1)
                    .filter(row => row[2] && row[24] && row[6])
                    .map(row => ({
                        topic: row[6]?.trim() || 'Unknown',
                        english: row[2]?.trim(),
                        vietnamese: row[24]?.trim()
                    }));

                if (allData.length === 0) {
                    showError('Không tìm thấy từ vựng nào');
                } else {
                    topics = Array.from(new Set(allData.map(item => item.topic))).sort();
                    populateTopics();
                    setGameState('setup');
                }
            }
        });
    } catch (err) {
        showError('Lỗi kết nối mạng hoặc link Google Sheets không hợp lệ');
    }
}

function populateTopics() {
    topicSelect.innerHTML = topics.map(t => `<option value="${t}">${t}</option>`).join('');
    selectedTopic = topics[0];
}

function showError(msg) {
    statusLine.textContent = msg;
    statusLine.classList.add('text-red-500');
    setGameState('setup');
}

function setGameState(state) {
    gameState = state;
    loadingScreen.classList.toggle('hidden', state !== 'loading');
    gameContainer.classList.toggle('hidden', state === 'loading');

    if (state === 'setup') {
        startBtn.disabled = false;
        topicSelect.disabled = false;
        countSelect.disabled = false;
        winnerMessage.classList.add('hidden');
        team1Elements.placeholder.classList.remove('hidden');
        team2Elements.placeholder.classList.remove('hidden');
        team1Elements.options.innerHTML = '';
        team2Elements.options.innerHTML = '';
        team1Elements.question.textContent = 'Sẵn sàng?';
        team2Elements.question.textContent = 'Sẵn sàng?';
    } else if (state === 'playing') {
        startBtn.disabled = true;
        topicSelect.disabled = true;
        countSelect.disabled = true;
        team1Elements.placeholder.classList.add('hidden');
        team2Elements.placeholder.classList.add('hidden');
    } else if (state === 'winner') {
        startBtn.disabled = true;
        winnerMessage.classList.remove('hidden');
        winnerMessage.textContent = `🏆 ĐỘI ${winner === 1 ? 'CHARIZARD' : 'BLASTOISE'} CHIẾN THẮNG! 🏆`;
        winnerMessage.className = `text-center text-4xl font-bold p-8 rounded-[30px] mt-5 animate-champion border-4 border-white text-white ${winner === 1 ? 'bg-gradient-to-br from-[#ff6b6b] to-[#ff8787]' : 'bg-gradient-to-br from-[#4ecdc4] to-[#6cd4cc]'}`;
    }
}

function generateQuestions(pool, count) {
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);

    return selected.map((item, idx) => {
        const distractors = pool
            .filter(p => p.english !== item.english)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3)
            .map(p => p.english);

        const options = [...distractors, item.english].sort(() => 0.5 - Math.random());

        return {
            vietnamese: item.vietnamese,
            correctAnswer: item.english,
            options
        };
    });
}

function startGame() {
    selectedTopic = topicSelect.value;
    questionCount = Number(countSelect.value);

    const pool = allData.filter(item => item.topic === selectedTopic);
    if (pool.length < 4) {
        alert('Chủ đề này không đủ từ vựng (cần ít nhất 4 từ).');
        return;
    }

    team1 = { score: 0, currentIndex: 0, questions: generateQuestions(pool, questionCount), isFinished: false };
    team2 = { score: 0, currentIndex: 0, questions: generateQuestions(pool, questionCount), isFinished: false };

    ropePosition = 0;
    winner = null;

    updateUI();
    setGameState('playing');
    renderQuestion(1);
    renderQuestion(2);
}

function updateUI() {
    scoreTeam1.textContent = team1.score;
    scoreTeam2.textContent = team2.score;
    ropeBar.style.left = `calc(50% + (${ropePosition} * 12%))`;

    team1Elements.progress.textContent = `${team1.currentIndex + 1}/${questionCount}`;
    team2Elements.progress.textContent = `${team2.currentIndex + 1}/${questionCount}`;

    footerRound.textContent = `Vòng ${Math.max(team1.currentIndex, team2.currentIndex) + 1}/${questionCount}`;
    footerTopic.textContent = `Chủ đề: ${selectedTopic}`;
}

function renderQuestion(teamNum) {
    const team = teamNum === 1 ? team1 : team2;
    const elements = teamNum === 1 ? team1Elements : team2Elements;

    if (team.isFinished) {
        elements.question.textContent = 'Xong!';
        elements.options.innerHTML = '';
        return;
    }

    const q = team.questions[team.currentIndex];
    elements.question.textContent = q.vietnamese;

    elements.options.innerHTML = q.options.map(opt => `
        <button class="option-btn p-5 rounded-[20px] border-3 border-[#333] font-black transition-all text-xl uppercase tracking-wide bg-white text-[#333] shadow-[0_4px_0_#333] hover:-translate-y-1 active:translate-y-0.5" data-option="${opt}">
            ${opt}
        </button>
    `).join('');

    const buttons = elements.options.querySelectorAll('.option-btn');
    buttons.forEach(btn => {
        btn.onclick = () => handleAnswer(teamNum, btn.dataset.option);
    });
}

function handleAnswer(teamNum, selectedOption) {
    if (gameState !== 'playing') return;

    const team = teamNum === 1 ? team1 : team2;
    if (team.isFinished) return;

    const q = team.questions[team.currentIndex];
    const isCorrect = selectedOption === q.correctAnswer;

    // Visual feedback
    const elements = teamNum === 1 ? team1Elements : team2Elements;
    const buttons = elements.options.querySelectorAll('.option-btn');
    buttons.forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.option === q.correctAnswer) {
            btn.className = "p-5 rounded-[20px] border-3 font-black transition-all text-xl uppercase tracking-wide bg-emerald-500 text-white border-emerald-700 shadow-[0_4px_0_#065f46]";
        } else if (btn.dataset.option === selectedOption && !isCorrect) {
            btn.className = "p-5 rounded-[20px] border-3 font-black transition-all text-xl uppercase tracking-wide bg-rose-500 text-white border-rose-700 shadow-[0_4px_0_#9f1239]";
        }
    });

    setTimeout(() => {
        if (isCorrect) {
            team.score++;
            ropePosition += (teamNum === 1 ? -1 : 1);
            if (Math.abs(ropePosition) >= 3) {
                winner = ropePosition <= -3 ? 1 : 2;
                setGameState('winner');
            }
        }

        team.currentIndex++;
        if (team.currentIndex >= questionCount) {
            team.isFinished = true;
        }

        updateUI();
        if (gameState === 'playing') {
            renderQuestion(teamNum);
        }
    }, 800);
}

function resetGame() {
    setGameState('setup');
    ropePosition = 0;
    updateUI();
}

// Event Listeners
startBtn.onclick = startGame;
resetBtn.onclick = resetGame;

// Run
init();
