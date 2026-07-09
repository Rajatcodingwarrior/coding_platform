"""
Unified Rating & Star System for all competitive programming platforms.

This module provides a consistent way to convert between different rating systems:
- Codeforces: Numerical rating (800-3500) — official from API
- LeetCode: Difficulty string (Easy/Medium/Hard) → mapped to numerical rating
- CodeChef: Star rating (1★ to 7★) derived from difficulty_rating
- AtCoder: Heuristic rating based on problem index position (A=800, B=1000, etc.)

We normalize everything into two fields:
  rating  (int)  — Codeforces-style numerical rating (800-3500)
  stars   (float) — CodeChef-style star rating (1.0 to 7.0)
"""

# ── Rating → Stars Conversion ─────────────────────────────────────────────────
# Maps numerical rating ranges to star levels (CodeChef-like scale)
# 1★ = Beginner (800-999), 2★ = Easy (1000-1199), 3★ = Moderate (1200-1399)
# 4★ = Intermediate (1400-1599), 5★ = Advanced (1600-1999), 6★ = Hard (2000-2499)
# 7★ = Expert (2500+)

def rating_to_stars(rating: int) -> float:
    """Convert a numerical rating (800-3500) to a star value (1.0 to 7.0)."""
    if rating is None or rating <= 0:
        rating = 800
    if rating < 1000:
        return 1.0 + (rating - 800) / 200.0 * 0.5  # 1.0 – 1.5
    elif rating < 1200:
        return 2.0 + (rating - 1000) / 200.0 * 0.5  # 2.0 – 2.5
    elif rating < 1400:
        return 3.0 + (rating - 1200) / 200.0 * 0.5  # 3.0 – 3.5
    elif rating < 1600:
        return 4.0 + (rating - 1400) / 200.0 * 0.5  # 4.0 – 4.5
    elif rating < 2000:
        return 5.0 + (rating - 1600) / 400.0 * 0.5  # 5.0 – 5.5
    elif rating < 2500:
        return 6.0 + (rating - 2000) / 500.0 * 0.5  # 6.0 – 6.5
    else:
        return 7.0


def stars_to_rating(stars: float) -> int:
    """Convert a star value (1.0-7.0) back to an approximate numerical rating."""
    if stars < 2.0:
        return int(800 + (stars - 1.0) / 0.5 * 200)
    elif stars < 3.0:
        return int(1000 + (stars - 2.0) / 0.5 * 200)
    elif stars < 4.0:
        return int(1200 + (stars - 3.0) / 0.5 * 200)
    elif stars < 5.0:
        return int(1400 + (stars - 4.0) / 0.5 * 200)
    elif stars < 6.0:
        return int(1600 + (stars - 5.0) / 0.5 * 400)
    elif stars < 7.0:
        return int(2000 + (stars - 6.0) / 0.5 * 500)
    else:
        return 2500


def get_difficulty_label(rating: int) -> str:
    """Get a human-readable difficulty label from numerical rating."""
    if rating < 1000:
        return "Newbie"
    elif rating < 1200:
        return "Easy"
    elif rating < 1400:
        return "Medium"
    elif rating < 1600:
        return "Intermediate"
    elif rating < 2000:
        return "Hard"
    elif rating < 2500:
        return "Expert"
    else:
        return "Legendary"


def get_difficulty_color(rating: int) -> str:
    """Get a CSS-friendly hex color for the rating level."""
    if rating < 1000:
        return "#808080"   # gray
    elif rating < 1200:
        return "#00C853"   # green
    elif rating < 1400:
        return "#FFD600"   # yellow
    elif rating < 1600:
        return "#FF9100"   # orange
    elif rating < 2000:
        return "#FF5252"   # red
    elif rating < 2500:
        return "#E040FB"   # purple
    else:
        return "#FF1744"   # deep red


# ── Platform-specific rating estimation ────────────────────────────────────────

def estimate_leetcode_rating(difficulty: str, problem_index: int = 0) -> int:
    """
    Estimate a numerical rating for a LeetCode problem.
    LeetCode provides difficulty as Easy/Medium/Hard.
    We further refine based on problem_index within a contest (0-based):
      Q1 (Easy) ≈ 800-1000, Q2 (Medium) ≈ 1200-1400, Q3 (Medium-Hard) ≈ 1400-1600, Q4 (Hard) ≈ 1800-2200
    """
    base_map = {"Easy": 900, "Medium": 1350, "Hard": 1900}
    base = base_map.get(difficulty, 1000)
    
    # Contest position refinement
    index_boost = {0: -100, 1: 0, 2: 150, 3: 350}
    boost = index_boost.get(problem_index, 0)
    
    return max(800, min(2500, base + boost))


def estimate_atcoder_rating(problem_label: str) -> int:
    """
    Estimate a numerical rating for an AtCoder problem based on its label.
    ABC contests: A≈100-200 (≈800), B≈200 (≈1000), C≈300 (≈1200),
    D≈400 (≈1400), E≈500 (≈1600), F≈600 (≈1800), G≈2000+, H≈2200+
    """
    if not problem_label:
        return 800
    char = problem_label[0].upper()
    # AtCoder problem difficulty estimation
    rating_map = {
        'A': 800,  'B': 1000, 'C': 1200, 'D': 1400,
        'E': 1600, 'F': 1800, 'G': 2100, 'H': 2400,
    }
    return rating_map.get(char, 800 + (ord(char) - ord('A')) * 200)


def estimate_codechef_rating(difficulty_rating: int) -> int:
    """
    CodeChef provides a difficulty_rating (0-5000) for problems.
    We map it to our standard numerical rating scale.
    If it's <= 0 or None, estimate from tags or default.
    """
    if difficulty_rating and difficulty_rating > 0:
        # CodeChef ratings roughly align: 
        # <1000 → beginner, 1000-1500 → easy, 1500-2000 → medium, 2000+ → hard
        return max(800, min(3000, difficulty_rating))
    return 1000  # default for unknown


def compute_rating_and_stars(platform: str, **kwargs) -> dict:
    """
    Main entry point: compute unified rating and stars for any platform.
    
    Args:
        platform: 'codeforces', 'leetcode', 'atcoder', 'codechef'
        **kwargs: Platform-specific fields:
            - codeforces: rating (from API)
            - leetcode: difficulty (str), problem_index (int)
            - atcoder: problem_label (str)
            - codechef: difficulty_rating (int)
    
    Returns:
        dict with 'rating' (int) and 'stars' (float)
    """
    if platform == 'codeforces':
        rating = kwargs.get('rating') or 800
        if rating <= 0:
            rating = 800
    elif platform == 'leetcode':
        difficulty = kwargs.get('difficulty', 'Easy')
        problem_index = kwargs.get('problem_index', 0)
        rating = estimate_leetcode_rating(difficulty, problem_index)
    elif platform == 'atcoder':
        label = kwargs.get('problem_label', 'A')
        rating = estimate_atcoder_rating(label)
    elif platform == 'codechef':
        diff_rating = kwargs.get('difficulty_rating', 0)
        rating = estimate_codechef_rating(diff_rating)
    else:
        rating = 800
    
    stars = rating_to_stars(rating)
    # Round stars to nearest 0.5
    stars = round(stars * 2) / 2
    
    return {"rating": rating, "stars": stars}
