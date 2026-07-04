import { useMemo, useState } from "react";
import vocabulary from "./data/vocabulary.json";
import readingTexts from "./data/readingTexts.json";
import "./App.css";
import unvalidIcon from "./assets/unvalid.svg";
import successSound from "./assets/true.mp3";
import errorSound from "./assets/false.mp3";

const LEVEL_LABELS = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
  pro: "Pro",
  expert: "Expert",
  genius: "Genius",
  swag: "Swag",
};

const STORAGE_KEY = "hanzi-app-stats-v1";

const successAudio = new Audio(successSound);
const errorAudio = new Audio(errorSound);

successAudio.preload = "auto";
errorAudio.preload = "auto";

function playSound(audio) {
  audio.pause();
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function getDefaultModeStats() {
  return { correct: 0, total: 0, streak: 0 };
}

function getDefaultStats() {
  return {
    lire: getDefaultModeStats(),
    ecrire: getDefaultModeStats(),
    hanzi: getDefaultModeStats(),
  };
}

function normalizeModeStats(modeStats) {
  return {
    correct: modeStats?.correct ?? 0,
    total: modeStats?.total ?? 0,
    streak: modeStats?.streak ?? 0,
  };
}

function normalizeWordStats(wordStats) {
  return {
    lire: normalizeModeStats(wordStats?.lire),
    ecrire: normalizeModeStats(wordStats?.ecrire),
    hanzi: normalizeModeStats(wordStats?.hanzi),
  };
}

function getPercent(stats) {
  if (!stats || stats.total === 0) return 0;
  return Math.round((stats.correct / stats.total) * 100);
}

function getModeStats(stats, wordId, mode) {
  return normalizeModeStats(stats[wordId]?.[mode]);
}

function isModeMastered(modeStats) {
  const normalized = normalizeModeStats(modeStats);

  return (
    normalized.total >= 10 &&
    normalized.correct === normalized.total &&
    normalized.streak >= 10
  );
}

function isMastered(wordStats) {
  const normalized = normalizeWordStats(wordStats);

  return (
    isModeMastered(normalized.lire) &&
    isModeMastered(normalized.ecrire) &&
    isModeMastered(normalized.hanzi)
  );
}

function getActiveWords(list, stats) {
  const activeWords = list.filter((word) => !isMastered(stats[word.id]));

  if (activeWords.length === 0) {
    return list;
  }

  return activeWords;
}

function getWeight(stats, wordId, mode) {
  const modeStats = getModeStats(stats, wordId, mode);
  return Math.max(1, 10 - modeStats.correct * 2);
}

function pickWeightedRandom(list, stats, mode, previousId = null) {
  const activeWords = getActiveWords(list, stats);

  const availableWords =
    activeWords.length > 1
      ? activeWords.filter((word) => word.id !== previousId)
      : activeWords;

  const weightedList = availableWords.flatMap((word) => {
    const weight = getWeight(stats, word.id, mode);
    return Array(weight).fill(word);
  });

  return weightedList[Math.floor(Math.random() * weightedList.length)];
}


function getAllVocabularyWords() {
  return Object.values(vocabulary).flat();
}

function getReadingWordInfo(token, words) {
  const tokenWord = typeof token === "string" ? token : token.word;

  const overrideInfo =
    typeof token === "object"
      ? {
          hanzi: token.word,
          pinyin: token.pinyin ?? "—",
          fr: token.fr ?? "mot hors vocabulaire",
        }
      : null;

  return (
    words.find((word) => word.hanzi === tokenWord) ??
    getAllVocabularyWords().find((word) => word.hanzi === tokenWord) ??
    {
      id: `reading-${tokenWord}`,
      hanzi: tokenWord,
      pinyin: overrideInfo?.pinyin ?? "—",
      fr: overrideInfo?.fr ?? "mot hors vocabulaire",
    }
  );
}

function buildQuestion(words, stats = {}, previousId = null) {
  const answer = pickWeightedRandom(words, stats, "lire", previousId);
  const activeWords = getActiveWords(words, stats);

  const wrongChoices = shuffle(
    activeWords.filter((word) => word.id !== answer.id)
  ).slice(0, 5);

  const choices = shuffle([answer, ...wrongChoices]);

  return { answer, choices };
}

function App() {
  const [view, setView] = useState("lire");
  const [level, setLevel] = useState("debutant");

  const words = useMemo(() => vocabulary[level] ?? [], [level]);

  const [stats, setStats] = useState(() => {
    const savedStats = localStorage.getItem(STORAGE_KEY);

    if (!savedStats) {
      return {};
    }

    try {
      return JSON.parse(savedStats);
    } catch {
      return {};
    }
  });

  const [question, setQuestion] = useState(() =>
    buildQuestion(vocabulary.debutant, stats)
  );

  const [selectedId, setSelectedId] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  const [writeQuestion, setWriteQuestion] = useState(() =>
    pickWeightedRandom(vocabulary.debutant, stats, "ecrire")
  );

  const [inputValue, setInputValue] = useState("");
  const [writeState, setWriteState] = useState("");
  const [writeLocked, setWriteLocked] = useState(false);
  const [showWriteAnswer, setShowWriteAnswer] = useState(false);

  const [hanziQuestion, setHanziQuestion] = useState(() =>
    pickWeightedRandom(vocabulary.debutant, stats, "hanzi")
  );

  const [hanziInputValue, setHanziInputValue] = useState("");
  const [hanziState, setHanziState] = useState("");
  const [hanziLocked, setHanziLocked] = useState(false);
  const [showHanziAnswer, setShowHanziAnswer] = useState(false);

  const [selectedReadingWord, setSelectedReadingWord] = useState(null);

  function updateStats(wordId, mode, isCorrect) {
    setStats((current) => {
      const wordStats = normalizeWordStats(current[wordId]);

      const nextStats = {
        ...current,
        [wordId]: {
          ...wordStats,
          [mode]: {
            correct: wordStats[mode].correct + (isCorrect ? 1 : 0),
            total: wordStats[mode].total + 1,
            streak: isCorrect ? wordStats[mode].streak + 1 : 0,
          },
        },
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStats));

      return nextStats;
    });
  }

  function changeLevel(nextLevel) {
    const nextWords = vocabulary[nextLevel] ?? [];

    setLevel(nextLevel);

    setSelectedId(null);
    setIsLocked(false);
    setQuestion(buildQuestion(nextWords, stats));

    setInputValue("");
    setWriteState("");
    setWriteLocked(false);
    setShowWriteAnswer(false);
    setWriteQuestion(pickWeightedRandom(nextWords, stats, "ecrire"));

    setHanziInputValue("");
    setHanziState("");
    setHanziLocked(false);
    setShowHanziAnswer(false);
    setHanziQuestion(pickWeightedRandom(nextWords, stats, "hanzi"));
  }

  function nextQuestion() {
    setQuestion((current) => buildQuestion(words, stats, current.answer.id));
    setSelectedId(null);
    setIsLocked(false);
  }

  function selectAnswer(choice) {
    if (isLocked) return;

    const isCorrect = choice.id === question.answer.id;

    if (isCorrect) {
      playSound(successAudio);
    } else {
      playSound(errorAudio);
    }

    setSelectedId(choice.id);
    setIsLocked(true);
    updateStats(question.answer.id, "lire", isCorrect);

    setTimeout(() => {
      nextQuestion();
    }, 1000);
  }

  function nextWriteQuestion() {
    const next = pickWeightedRandom(words, stats, "ecrire", writeQuestion.id);

    setWriteQuestion(next);
    setInputValue("");
    setWriteState("");
    setWriteLocked(false);
    setShowWriteAnswer(false);
  }

  function validateWrite() {
    if (writeLocked) return;

    const answer = inputValue.trim();
    const isCorrect = answer === writeQuestion.hanzi;

    updateStats(writeQuestion.id, "ecrire", isCorrect);

    if (isCorrect) {
      playSound(successAudio);
      setWriteState("correct");
      setWriteLocked(true);

      setTimeout(() => {
        nextWriteQuestion();
      }, 1000);
    } else {
      playSound(errorAudio);
      setWriteState("wrong");
    }
  }

  function revealWriteAnswer() {
    if (writeLocked) return;

    playSound(errorAudio);
    updateStats(writeQuestion.id, "ecrire", false);

    setShowWriteAnswer(true);
    setWriteLocked(true);

    setTimeout(() => {
      nextWriteQuestion();
    }, 2000);
  }

  function nextHanziQuestion() {
    const next = pickWeightedRandom(words, stats, "hanzi", hanziQuestion.id);

    setHanziQuestion(next);
    setHanziInputValue("");
    setHanziState("");
    setHanziLocked(false);
    setShowHanziAnswer(false);
  }

  function validateHanzi() {
    if (hanziLocked) return;

    const answer = hanziInputValue.trim();
    const isCorrect = answer === hanziQuestion.hanzi;

    updateStats(hanziQuestion.id, "hanzi", isCorrect);

    if (isCorrect) {
      playSound(successAudio);
      setHanziState("correct");
      setHanziLocked(true);

      setTimeout(() => {
        nextHanziQuestion();
      }, 1000);
    } else {
      playSound(errorAudio);
      setHanziState("wrong");
    }
  }

  function revealHanziAnswer() {
    if (hanziLocked) return;

    playSound(errorAudio);
    updateStats(hanziQuestion.id, "hanzi", false);

    setShowHanziAnswer(true);
    setHanziLocked(true);

    setTimeout(() => {
      nextHanziQuestion();
    }, 2000);
  }

  function handleWriteKeyDown(event) {
    if (event.key === "Enter") {
      validateWrite();
    }
  }

  function handleHanziKeyDown(event) {
    if (event.key === "Enter") {
      validateHanzi();
    }
  }

  return (
    <main className="app">
      <nav className="navbar">
        <button
          className={view === "lire" ? "active" : ""}
          onClick={() => setView("lire")}
        >
          Lire
        </button>

        <button
          className={view === "ecrire" ? "active" : ""}
          onClick={() => setView("ecrire")}
        >
          Écrire
        </button>

        <button
          className={view === "hanzi" ? "active" : ""}
          onClick={() => setView("hanzi")}
        >
          Hanzi
        </button>

        <button
          className={view === "lecture" ? "active" : ""}
          onClick={() => setView("lecture")}
        >
          Lecture
        </button>

        <button
          className={view === "biblio" ? "active" : ""}
          onClick={() => setView("biblio")}
        >
          Biblio
        </button>
      </nav>

      {view === "lire" && (
        <section className="page practice-page">
          <div className="level-tabs">
            {Object.entries(LEVEL_LABELS).map(([key, label]) => (
              <button
                key={key}
                className={`level-tab ${level === key ? "active" : ""}`}
                onClick={() => changeLevel(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="hanzi-card">
            <p>Choisis la bonne traduction</p>
            <h1>{question.answer.hanzi}</h1>
            <span>{question.answer.pinyin}</span>
          </div>

          <div className="choices-column">
            {question.choices.map((choice) => {
              const isSelected = selectedId === choice.id;
              const isCorrect = choice.id === question.answer.id;
              const shouldShowCorrection = isLocked && isCorrect;

              return (
                <button
                  key={choice.id}
                  className={`choice-button ${
                    isSelected
                      ? isCorrect
                        ? "correct"
                        : "wrong"
                      : shouldShowCorrection
                        ? "correct"
                        : ""
                  }`}
                  onClick={() => selectAnswer(choice)}
                  disabled={isLocked}
                >
                  {choice.fr}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {view === "ecrire" && (
        <section className="page practice-page">
          <div className="level-tabs">
            {Object.entries(LEVEL_LABELS).map(([key, label]) => (
              <button
                key={key}
                className={`level-tab ${level === key ? "active" : ""}`}
                onClick={() => changeLevel(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="hanzi-card write-card">
            <p>Écris le hanzi correspondant</p>
            <h2>{writeQuestion.fr}</h2>
          </div>

          {showWriteAnswer && (
            <div className="answer-reveal">
              <span>Réponse</span>
              <strong>{writeQuestion.hanzi}</strong>
              <em>{writeQuestion.pinyin}</em>
            </div>
          )}

          <div className="write-container">
            <div className="write-row">
              <input
                className={`hanzi-input ${writeState}`}
                type="text"
                value={inputValue}
                onChange={(event) => {
                  setInputValue(event.target.value);

                  if (writeState === "wrong") {
                    setWriteState("");
                  }
                }}
                onKeyDown={handleWriteKeyDown}
                disabled={writeLocked}
              />

              <button
                className="dont-know-button"
                onClick={revealWriteAnswer}
                disabled={writeLocked}
                aria-label="Je ne sais pas"
              >
                <img src={unvalidIcon} alt="" className="dont-know-icon" />
              </button>
            </div>

            <button
              className="validate-button"
              onClick={validateWrite}
              disabled={writeLocked}
            >
              Valider
            </button>
          </div>
        </section>
      )}

      {view === "hanzi" && (
        <section className="page practice-page">
          <div className="level-tabs">
            {Object.entries(LEVEL_LABELS).map(([key, label]) => (
              <button
                key={key}
                className={`level-tab ${level === key ? "active" : ""}`}
                onClick={() => changeLevel(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="hanzi-card">
            <p>Recopie le hanzi sans pinyin</p>
            <h1>{hanziQuestion.hanzi}</h1>
          </div>

          {showHanziAnswer && (
            <div className="answer-reveal">
              <span>Réponse</span>
              <strong>{hanziQuestion.hanzi}</strong>
              <em>{hanziQuestion.pinyin}</em>
            </div>
          )}

          <div className="write-container">
            <div className="write-row">
              <input
                className={`hanzi-input ${hanziState}`}
                type="text"
                value={hanziInputValue}
                onChange={(event) => {
                  setHanziInputValue(event.target.value);

                  if (hanziState === "wrong") {
                    setHanziState("");
                  }
                }}
                onKeyDown={handleHanziKeyDown}
                disabled={hanziLocked}
              />

              <button
                className="dont-know-button"
                onClick={revealHanziAnswer}
                disabled={hanziLocked}
                aria-label="Je ne sais pas"
              >
                <img src={unvalidIcon} alt="" className="dont-know-icon" />
              </button>
            </div>

            <button
              className="validate-button"
              onClick={validateHanzi}
              disabled={hanziLocked}
            >
              Valider
            </button>
          </div>
        </section>
      )}


      {view === "lecture" && (
        <section className="page lecture-page">
          <div className="level-tabs">
            {Object.entries(LEVEL_LABELS).map(([key, label]) => (
              <button
                key={key}
                className={`level-tab ${level === key ? "active" : ""}`}
                onClick={() => changeLevel(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="lecture-reading-card">
            <p className="lecture-kicker">Lecture libre</p>

            <div className="lecture-text">
              {(readingTexts[level] ?? []).map((paragraph, paragraphIndex) => (
                <p key={`paragraph-${paragraphIndex}`} className="lecture-paragraph-line">
                  {paragraph.map((token, tokenIndex) => {
                    if (typeof token === "string") {
                      return <span key={`text-${paragraphIndex}-${tokenIndex}`}>{token}</span>;
                    }

                    const wordInfo = getReadingWordInfo(token, words);

                    return (
                      <button
                        key={`word-${paragraphIndex}-${tokenIndex}-${token.word}`}
                        className="lecture-word"
                        onClick={() => setSelectedReadingWord(wordInfo)}
                      >
                        {token.word}
                      </button>
                    );
                  })}
                </p>
              ))}
            </div>
          </div>

          {selectedReadingWord && (
            <div
              className="modal-backdrop"
              onClick={() => setSelectedReadingWord(null)}
            >
              <div
                className="reading-modal"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  className="modal-close"
                  onClick={() => setSelectedReadingWord(null)}
                  aria-label="Fermer"
                >
                  ×
                </button>

                <strong>{selectedReadingWord.hanzi}</strong>
                <span>{selectedReadingWord.pinyin}</span>
                <p>{selectedReadingWord.fr}</p>
              </div>
            </div>
          )}
        </section>
      )}

      {view === "biblio" && (
        <section className="page biblio-page">
          <div className="level-tabs">
            {Object.entries(LEVEL_LABELS).map(([key, label]) => (
              <button
                key={key}
                className={`level-tab ${level === key ? "active" : ""}`}
                onClick={() => changeLevel(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="biblio-list">
            {getActiveWords(words, stats).map((word) => {
              const wordStats = normalizeWordStats(stats[word.id]);

              return (
                <article key={word.id} className="biblio-card">
                  <div className="biblio-header">
                    <h2>{word.hanzi}</h2>
                    <p className="biblio-pinyin">{word.pinyin}</p>
                    <p className="biblio-fr">{word.fr}</p>
                  </div>

                  <div className="stats-row">
                    <div className="stats-column">
                      <span>Lu</span>
                      <strong>{getPercent(wordStats.lire)}%</strong>
                    </div>

                    <div className="stats-column">
                      <span>Écrit</span>
                      <strong>{getPercent(wordStats.ecrire)}%</strong>
                    </div>

                    <div className="stats-column">
                      <span>Hanzi</span>
                      <strong>{getPercent(wordStats.hanzi)}%</strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

export default App;
