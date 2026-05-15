import anthropic
import json
import re
from typing import Any


SYSTEM_PROMPT = """You are an elite binary options technical analyst specializing in Pocket Option charts.
Your role is to analyze trading chart screenshots with extreme precision and provide actionable signals.

You have mastery over:
- Candlestick pattern recognition (doji, engulfing, hammer, shooting star, morning/evening star, pin bars, etc.)
- MACD (12,26,9): histogram direction, signal line crossovers, divergence
- EMA alignment: EMA8 (fast), EMA15 (medium), EMA35 (slow) — trend strength and direction
- Stochastic Oscillator (14,3,3): overbought/oversold zones, crossovers, divergence
- ZigZag: higher highs/lower lows, trend structure, reversal points
- Vortex Indicator (14): VI+ vs VI- crossovers and trend confirmation

You must respond ONLY with valid JSON. No markdown, no explanation outside JSON."""


def build_analysis_prompt(timeframe: str) -> str:
    timeframe_minutes = int(timeframe.replace("m", ""))

    if timeframe_minutes == 2:
        expiry_note = "2-minute expiry: Focus heavily on momentum, immediate candlestick patterns, and short-term oscillator signals."
    elif timeframe_minutes == 5:
        expiry_note = "5-minute expiry: Balance between momentum indicators and trend-following signals."
    else:
        expiry_note = "10-minute expiry: Prioritize trend strength, EMA alignment, and MACD confirmation over pure momentum."

    return f"""Analyze this Pocket Option binary options chart screenshot for a {timeframe} trade.

{expiry_note}

Examine ALL visible indicators and price action carefully. Then return your analysis as JSON with this EXACT structure:

{{
  "signal": "BUY" | "SELL" | "NEUTRAL",
  "confidence": <integer 0-100>,
  "entry_recommendation": "ENTER NOW" | "WAIT FOR CONFIRMATION" | "SKIP THIS TRADE",
  "summary": "<2-3 sentence overall analysis>",
  "indicators": {{
    "candlestick_patterns": {{
      "patterns_detected": ["<pattern1>", "<pattern2>"],
      "signal": "BUY" | "SELL" | "NEUTRAL",
      "strength": "STRONG" | "MODERATE" | "WEAK",
      "description": "<what patterns are visible and their implication>"
    }},
    "macd": {{
      "histogram": "POSITIVE" | "NEGATIVE" | "NEAR_ZERO",
      "trend": "BULLISH" | "BEARISH" | "NEUTRAL",
      "crossover": "BULLISH_CROSS" | "BEARISH_CROSS" | "NONE",
      "divergence": "BULLISH" | "BEARISH" | "NONE",
      "signal": "BUY" | "SELL" | "NEUTRAL",
      "description": "<MACD state and momentum direction>"
    }},
    "ema_alignment": {{
      "ema8_position": "ABOVE_PRICE" | "BELOW_PRICE" | "AT_PRICE",
      "ema15_position": "ABOVE_PRICE" | "BELOW_PRICE" | "AT_PRICE",
      "ema35_position": "ABOVE_PRICE" | "BELOW_PRICE" | "AT_PRICE",
      "alignment": "BULLISH_STACK" | "BEARISH_STACK" | "MIXED" | "CONVERGING",
      "signal": "BUY" | "SELL" | "NEUTRAL",
      "description": "<EMA stack order and trend interpretation>"
    }},
    "stochastic": {{
      "k_value": "<estimated value or range like '20-30'>",
      "d_value": "<estimated value or range>",
      "zone": "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL",
      "crossover": "BULLISH_CROSS" | "BEARISH_CROSS" | "NONE",
      "signal": "BUY" | "SELL" | "NEUTRAL",
      "description": "<stochastic position and momentum>"
    }},
    "zigzag": {{
      "trend_structure": "HIGHER_HIGHS_HIGHER_LOWS" | "LOWER_HIGHS_LOWER_LOWS" | "MIXED",
      "last_pivot": "HIGH" | "LOW",
      "signal": "BUY" | "SELL" | "NEUTRAL",
      "description": "<zigzag pattern and trend direction>"
    }},
    "vortex": {{
      "vi_plus": "DOMINANT" | "WEAK",
      "vi_minus": "DOMINANT" | "WEAK",
      "crossover": "BULLISH_CROSS" | "BEARISH_CROSS" | "NONE",
      "signal": "BUY" | "SELL" | "NEUTRAL",
      "description": "<vortex trend confirmation>"
    }}
  }},
  "confluence_score": {{
    "bullish_signals": <integer count of bullish indicator signals>,
    "bearish_signals": <integer count of bearish indicator signals>,
    "neutral_signals": <integer count of neutral indicator signals>
  }},
  "risk_assessment": {{
    "level": "LOW" | "MEDIUM" | "HIGH",
    "notes": "<key risk factors or favorable conditions for this trade>"
  }},
  "timeframe_analysis": {{
    "timeframe": "{timeframe}",
    "optimal_entry": "<describe the ideal entry moment based on this timeframe>",
    "key_levels": "<support/resistance levels visible on the chart>"
  }}
}}

IMPORTANT RULES:
1. If indicators are NOT visible in the screenshot, still estimate from price action and what IS visible.
2. Never refuse to give a signal — always provide your best analysis.
3. If the chart is unclear, set confidence below 50 and signal to NEUTRAL.
4. Count confluence: if 4+ indicators agree on direction, confidence should be 75+.
5. Respond with ONLY the JSON object, no other text."""


async def analyze_chart(
    image_b64: str,
    media_type: str,
    timeframe: str,
    api_key: str,
) -> dict[str, Any]:
    client = anthropic.Anthropic(api_key=api_key)

    prompt = build_analysis_prompt(timeframe)

    message = client.messages.create(
        model="claude-opus-4-5",
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": prompt,
                    },
                ],
            }
        ],
    )

    raw_text = message.content[0].text.strip()

    raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
    raw_text = re.sub(r"\s*```$", "", raw_text)

    result = json.loads(raw_text)

    result["model_used"] = message.model
    result["input_tokens"] = message.usage.input_tokens
    result["output_tokens"] = message.usage.output_tokens

    return result
