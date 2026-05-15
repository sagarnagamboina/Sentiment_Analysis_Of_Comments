"""
nlp_engine.py
Direct port of modules/nlp_utils.py + modules/data_processor.py
Only Groq is used (groq-oss-120b / llama-3.1-8b-instant).
Groq API key is hardcoded here — no manual entry needed.
"""
import re
import os
from collections import Counter
from textblob import TextBlob

try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

# ── Hardcoded Groq key (set via env or leave the placeholder) ─────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "gsk_your_groq_key_here")

# ── Stopwords (identical to original) ─────────────────────────────────────────
STOPWORDS = set([
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", "yourself",
    "yourselves", "he", "him", "his", "himself", "she", "her", "hers", "herself", "it", "its", "itself",
    "they", "them", "their", "theirs", "themselves", "what", "which", "who", "whom", "this", "that",
    "these", "those", "am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "having", "do", "does", "did", "doing", "a", "an", "the", "and", "but", "if", "or", "because", "as",
    "until", "while", "of", "at", "by", "for", "with", "about", "against", "between", "into", "through",
    "during", "before", "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off",
    "over", "under", "again", "further", "then", "once", "here", "there", "when", "where", "why", "how",
    "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not",
    "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "don", "should",
    "now", "policy", "law", "section", "act",
])


# ── Sentiment helpers (identical to original) ─────────────────────────────────
def get_sentiment_score(text: str) -> float:
    return TextBlob(str(text)).sentiment.polarity


def label_sentiment(score: float) -> str:
    if score > 0.05:
        return "Positive"
    elif score < -0.05:
        return "Negative"
    return "Neutral"


def generate_short_summary(text: str) -> str:
    text = str(text)
    words = text.split()
    lower = text.lower()

    if len(words) <= 8:
        return text.capitalize()
    if "but" in lower or "however" in lower:
        parts = re.split(r'\b(but|however)\b', text, flags=re.IGNORECASE)
        return f"Mixed: {parts[0].strip()}..."
    if any(w in lower for w in ["not", "bad", "issue", "problem", "confusing", "unclear", "difficult", "hard"]):
        return f"Concern: {' '.join(words[:8])}..."
    if any(w in lower for w in ["good", "great", "excellent", "useful", "effective", "easy", "support"]):
        return f"Positive: {' '.join(words[:8])}..."
    if any(w in lower for w in ["should", "improve", "suggest", "recommend", "need"]):
        return f"Suggestion: {' '.join(words[:8])}..."
    return f"{' '.join(words[:8])}..."


# ── Keyword extraction (identical to original) ─────────────────────────────────
def extract_keywords(texts, top_n: int = 10) -> list:
    words = []
    for text in texts:
        clean = re.sub(r'[^\w\s]', '', str(text).lower())
        words.extend([w for w in clean.split() if w not in STOPWORDS and len(w) > 2])
    return Counter(words).most_common(top_n)


# ── Extractive summary (identical to original) ────────────────────────────────
def extractive_summary(texts, top_n: int = 3) -> list:
    text_list = [str(t) for t in texts if len(str(t).strip()) > 10]
    if not text_list:
        return []

    words = []
    for text in text_list:
        clean = re.sub(r'[^\w\s]', '', text.lower())
        words.extend([w for w in clean.split() if w not in STOPWORDS and len(w) > 2])

    freq_dist = Counter(words)
    max_freq = max(freq_dist.values()) if freq_dist else 1
    for word in freq_dist:
        freq_dist[word] /= max_freq

    scores = []
    for text in text_list:
        clean = re.sub(r'[^\w\s]', '', text.lower())
        comment_words = [w for w in clean.split() if w not in STOPWORDS and len(w) > 2]
        score = sum(freq_dist.get(w, 0) for w in comment_words)
        penalty = 20 / len(comment_words) if len(comment_words) > 20 else (0.5 if len(comment_words) < 4 else 1.0)
        scores.append((score * penalty, text))

    scores.sort(key=lambda x: x[0], reverse=True)
    seen, summary = set(), []
    for _, text in scores:
        if text not in seen:
            summary.append(text)
            seen.add(text)
        if len(summary) >= top_n:
            break
    return summary


# ── Groq summary — same as original generate_groq_summary ─────────────────────
def generate_groq_summary(texts, api_key: str = None) -> list:
    key = api_key or GROQ_API_KEY
    if not GROQ_AVAILABLE:
        return ["Error: groq library not installed."]
    if not key or "your_groq_key" in key:
        return extractive_summary(texts, top_n=4)

    try:
        client = Groq(api_key=key)
        all_comments = "\n- ".join([str(t) for t in texts if len(str(t).strip()) > 5])
        if len(all_comments) > 15000:
            all_comments = all_comments[:15000] + "\n... (truncated)"

        prompt = f"""You are an expert Policy Analyst. I am providing you with raw feedback comments regarding a policy or legislation.
Your task is to write a highly professional, 3-bullet-point Executive Summary of this feedback.
Focus on the core sentiments, major pain points, and actionable recommendations.
Do NOT use markdown formatting like **bold** in the bullet points themselves, just provide clean text.
Prefix each bullet point with a simple hyphen.

Raw Feedback:
- {all_comments}"""

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "You are a helpful and expert AI assistant."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
        )
        text_resp = response.choices[0].message.content
        lines = text_resp.split("\n")
        bullets = [
            line.strip().lstrip("-").lstrip("*").strip()
            for line in lines
            if line.strip().startswith(("-", "*"))
        ]
        return bullets if bullets else [text_resp]
    except Exception as e:
        return [f"Groq API Error: {str(e)}"]


# ── generate_insights (identical logic to original) ────────────────────────────
def generate_insights(records: list, text_col: str, api_key: str = None) -> dict:
    total = len(records)
    if total == 0:
        return None

    counts = {"Positive": 0, "Negative": 0, "Neutral": 0}
    score_sum = 0.0
    pos_texts, neg_texts, all_texts = [], [], []

    for r in records:
        s = r.get("Sentiment", "Neutral")
        counts[s] = counts.get(s, 0) + 1
        score_sum += float(r.get("Score", 0))
        txt = str(r.get(text_col, ""))
        all_texts.append(txt)
        if s == "Positive":
            pos_texts.append(txt)
        elif s == "Negative":
            neg_texts.append(txt)

    pos_pct = (counts["Positive"] / total) * 100
    neg_pct = (counts["Negative"] / total) * 100
    neu_pct = (counts["Neutral"] / total) * 100
    avg_score = score_sum / total

    pos_keywords = extract_keywords(pos_texts, 5)
    neg_keywords = extract_keywords(neg_texts, 5)
    all_keywords = extract_keywords(all_texts, 10)

    summary_sentences = generate_groq_summary(all_texts, api_key)
    if summary_sentences and "Error" in summary_sentences[0]:
        fallback = extractive_summary(all_texts, top_n=4)
        summary_sentences = [summary_sentences[0]] + fallback

    return {
        "total": total,
        "pos": counts["Positive"], "neg": counts["Negative"], "neu": counts["Neutral"],
        "pos_pct": pos_pct, "neg_pct": neg_pct, "neu_pct": neu_pct,
        "avg_score": avg_score,
        "pos_keywords": pos_keywords,
        "neg_keywords": neg_keywords,
        "all_keywords_with_counts": all_keywords,
        "summary_sentences": summary_sentences,
    }


# ── cluster_themes (identical to original) ────────────────────────────────────
def cluster_themes(texts: list) -> dict:
    theme_map = {
        "Complexity & Clarity": ["complex", "confusing", "hard", "difficult", "unclear", "understand", "clarify"],
        "Suggestions & Ideas":  ["should", "suggest", "recommend", "improve", "need", "could", "better"],
        "Positive Feedback":    ["good", "great", "excellent", "support", "agree", "useful", "effective"],
        "Process & Timeline":   ["time", "delay", "process", "slow", "fast", "duration", "wait"],
    }
    clusters = {k: [] for k in theme_map}
    clusters["Other / General"] = []

    for text in texts:
        lower = str(text).lower()
        matched = False
        for theme, keywords in theme_map.items():
            if any(k in lower for k in keywords):
                clusters[theme].append(text)
                matched = True
                break
        if not matched:
            clusters["Other / General"].append(text)

    return {k: v for k, v in clusters.items() if v}


# ── auto_detect_columns (identical to original) ───────────────────────────────
def auto_detect_columns(columns: list) -> dict:
    policy_col  = next((c for c in columns if "policy" in c.lower() or "law" in c.lower()), None)
    section_col = next((c for c in columns if "section" in c.lower() or "category" in c.lower()), None)
    text_col    = next((c for c in columns if "comment" in c.lower() or "text" in c.lower() or "feedback" in c.lower()), None)
    date_col    = next((c for c in columns if "date" in c.lower() or "time" in c.lower()), None)

    if not text_col:
        assigned = {policy_col, section_col, date_col}
        text_col = next((c for c in columns if c not in assigned), None)

    return {
        "policy_col":  policy_col,
        "section_col": section_col,
        "text_col":    text_col,
        "date_col":    date_col,
    }
