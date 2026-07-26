#!/usr/bin/env python3
"""Render MILESTONE_1_VIDEO_SCRIPT.md (中英混排) into a clean PDF."""
import re
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable, ListFlowable, ListItem,
)

SRC = "/Users/phoebewang/Desktop/rallypoint/docs/MILESTONE_1_VIDEO_SCRIPT.md"
OUT = "/Users/phoebewang/Desktop/rallypoint/docs/MILESTONE_1_VIDEO_SCRIPT.pdf"

SONGTI = "/System/Library/Fonts/Supplemental/Songti.ttc"
pdfmetrics.registerFont(TTFont("Songti", SONGTI, subfontIndex=6))       # SC Regular
pdfmetrics.registerFont(TTFont("Songti-Bold", SONGTI, subfontIndex=1))  # SC Bold
pdfmetrics.registerFontFamily(
    "Songti", normal="Songti", bold="Songti-Bold",
    italic="Songti", boldItalic="Songti-Bold",
)

INK = colors.HexColor("#1a2b22")
ACCENT = colors.HexColor("#1f7a4d")
MUTED = colors.HexColor("#5b6b63")
QUOTE_BG = colors.HexColor("#f0f6f2")

styles = getSampleStyleSheet()
body = ParagraphStyle(
    "Body", parent=styles["Normal"], fontName="Songti", fontSize=10.2,
    leading=16, textColor=INK, spaceAfter=8, wordWrap="CJK",
)
h1 = ParagraphStyle(
    "H1", parent=body, fontName="Songti-Bold", fontSize=13.5,
    leading=18, textColor=ACCENT, spaceBefore=16, spaceAfter=8,
)
title = ParagraphStyle(
    "TitleZh", parent=body, fontName="Songti-Bold", fontSize=20,
    leading=26, alignment=TA_CENTER, spaceAfter=4,
)
subtitle = ParagraphStyle(
    "Subtitle", parent=body, fontSize=11, leading=15, textColor=MUTED,
    alignment=TA_CENTER, spaceAfter=2,
)
meta = ParagraphStyle(
    "Meta", parent=body, fontSize=9.5, leading=15, textColor=MUTED,
    alignment=TA_CENTER, spaceAfter=0,
)
scene = ParagraphStyle(
    "Scene", parent=body, fontSize=9.6, leading=14.5, textColor=MUTED,
    spaceBefore=6, spaceAfter=3,
)
narration = ParagraphStyle(
    "Narration", parent=styles["Normal"], fontName="Helvetica", fontSize=10.4,
    leading=15.5, textColor=INK, leftIndent=14, rightIndent=6,
    spaceAfter=8, backColor=QUOTE_BG, borderPadding=(5, 6, 5, 6),
    borderColor=QUOTE_BG, borderWidth=1,
)
note = ParagraphStyle(
    "Note", parent=body, fontSize=9, leading=13.5, textColor=MUTED,
    spaceBefore=2, spaceAfter=6,
)
bullet = ParagraphStyle("Bullet", parent=body, fontSize=9.8, leading=15, spaceAfter=4)


def esc(t: str) -> str:
    t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"`([^`]+)`", r'<font face="Courier" size="9">\1</font>', t)
    return t


with open(SRC, encoding="utf-8") as f:
    lines = f.read().split("\n")

story = [
    Paragraph("RallyPoint", title),
    Paragraph("Milestone 1 演示视频脚本 · Demo Video Script (Front-End Component)", subtitle),
    Spacer(1, 6),
]

# Line 3 is the meta block: split "｜"-separated facts onto their own lines.
meta_line = lines[2].strip().strip("*")
for part in [p.strip() for p in meta_line.split("｜")]:
    story.append(Paragraph(esc(part), meta))
story.append(Spacer(1, 8))
story.append(HRFlowable(width="100%", thickness=1.1, color=ACCENT, spaceAfter=10))

pending_bullets = []


def flush_bullets():
    global pending_bullets
    if pending_bullets:
        items = [ListItem(Paragraph(esc(b), bullet), leftIndent=6, value="•")
                 for b in pending_bullets]
        story.append(ListFlowable(items, bulletType="bullet", leftIndent=14,
                                  bulletColor=ACCENT, spaceAfter=8))
        pending_bullets = []


for raw in lines[3:]:
    line = raw.strip()
    if not line or line == "---":
        flush_bullets()
        continue
    if line.startswith("## "):
        flush_bullets()
        story.append(Paragraph(esc(line[3:]), h1))
        continue
    if line.startswith("### "):
        flush_bullets()
        story.append(Paragraph(esc(line[4:]), h1))
        continue
    if line.startswith("- "):
        pending_bullets.append(line[2:])
        continue
    if line.startswith("**【画面】**"):
        flush_bullets()
        text = line.replace("**【画面】**", "").strip()
        story.append(Paragraph(f'<font color="#1f7a4d"><b>【画面】</b></font> {esc(text)}', scene))
        continue
    if line.startswith(">"):
        flush_bullets()
        text = line.lstrip("> ").strip()
        text = re.sub(r"^「念」\s*", "", text)
        story.append(Paragraph(esc(text), narration))
        continue
    if line.startswith("*") and line.endswith("*"):
        flush_bullets()
        story.append(Paragraph(esc(line.strip("*").strip()), note))
        continue
    flush_bullets()
    story.append(Paragraph(esc(line), body))

flush_bullets()


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.85 * inch, 0.5 * inch, "RallyPoint — Milestone 1 Video Script")
    canvas.drawRightString(letter[0] - 0.85 * inch, 0.5 * inch, f"Page {doc.page}")
    canvas.restoreState()


doc = SimpleDocTemplate(
    OUT, pagesize=letter,
    leftMargin=0.85 * inch, rightMargin=0.85 * inch,
    topMargin=0.8 * inch, bottomMargin=0.8 * inch,
    title="RallyPoint — Milestone 1 Video Script", author="Phoebe Wang",
)
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print("wrote", OUT)
