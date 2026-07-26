#!/usr/bin/env python3
"""Render MILESTONE_1_REFLECTION.md into a clean, professional PDF."""
import re
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable, ListFlowable, ListItem,
)

SRC = "/Users/phoebewang/Desktop/rallypoint/docs/MILESTONE_1_REFLECTION.md"
OUT = "/Users/phoebewang/Desktop/rallypoint/docs/MILESTONE_1_REFLECTION.pdf"

INK = colors.HexColor("#1a2b22")
ACCENT = colors.HexColor("#1f7a4d")
MUTED = colors.HexColor("#5b6b63")

styles = getSampleStyleSheet()
body = ParagraphStyle(
    "Body", parent=styles["Normal"], fontName="Helvetica", fontSize=10.2,
    leading=15.5, alignment=TA_JUSTIFY, textColor=INK, spaceAfter=9,
)
h1 = ParagraphStyle(
    "H1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=14,
    leading=18, textColor=ACCENT, spaceBefore=18, spaceAfter=8,
)
title = ParagraphStyle(
    "Title", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=22,
    leading=26, textColor=INK, alignment=TA_CENTER, spaceAfter=4,
)
subtitle = ParagraphStyle(
    "Subtitle", parent=styles["Normal"], fontName="Helvetica", fontSize=11,
    leading=15, textColor=MUTED, alignment=TA_CENTER, spaceAfter=2,
)
meta = ParagraphStyle(
    "Meta", parent=styles["Normal"], fontName="Helvetica", fontSize=9.5,
    leading=14, textColor=MUTED, alignment=TA_CENTER,
)
bullet = ParagraphStyle(
    "Bullet", parent=body, spaceAfter=4,
)
ref = ParagraphStyle(
    "Ref", parent=body, fontSize=9.2, leading=13, spaceAfter=6,
)


def esc(t: str) -> str:
    t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    # bold **...**
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    # bare URLs -> clickable links
    t = re.sub(r"(https?://[^\s\]]+)",
               r'<link href="\1"><font color="#1f7a4d">\1</font></link>', t)
    return t


with open(SRC, encoding="utf-8") as f:
    lines = f.read().split("\n")

story = []

# --- Header block (first 8 lines are the masthead) ---
story.append(Paragraph("RallyPoint", title))
story.append(Paragraph("Milestone 1 &mdash; Written Reflection", subtitle))
story.append(Spacer(1, 6))
header_meta = [
    "Author: Phoebe Wang",
    "Course: ACIS 498, Northwestern University",
    "Milestone: Milestone 1 &mdash; Front-End Component",
    "Date: June 22, 2026",
    'Repository: <link href="https://github.com/phoebewong214/rallypoint"><font color="#1f7a4d">github.com/phoebewong214/rallypoint</font></link>',
    'Live demo: <link href="https://app.tryrallypoint.com"><font color="#1f7a4d">app.tryrallypoint.com</font></link>',
]
for m in header_meta:
    story.append(Paragraph(m, meta))
story.append(Spacer(1, 8))
story.append(HRFlowable(width="100%", thickness=1.1, color=ACCENT, spaceAfter=12))

# Skip masthead lines (0-8) and intro paragraph handled in loop
i = 9
section_re = re.compile(r"^\d+\.\s")
pending_bullets = []


def flush_bullets():
    global pending_bullets
    if pending_bullets:
        items = [ListItem(Paragraph(esc(b), bullet), leftIndent=6,
                          value="•") for b in pending_bullets]
        story.append(ListFlowable(items, bulletType="bullet", leftIndent=14,
                                  bulletColor=ACCENT, spaceAfter=8))
        pending_bullets = []


in_refs = False
while i < len(lines):
    raw = lines[i]
    line = raw.strip()
    i += 1
    if not line:
        flush_bullets()
        continue
    if line == "References":
        flush_bullets()
        story.append(Spacer(1, 6))
        story.append(HRFlowable(width="100%", thickness=0.8, color=MUTED, spaceAfter=8))
        story.append(Paragraph("References", h1))
        in_refs = True
        continue
    if in_refs:
        story.append(Paragraph(esc(line), ref))
        continue
    # Numbered section header (e.g. "1. Self-Evaluation and Reflection")
    if section_re.match(line) and len(line) < 70 and not line[-1] == ".":
        flush_bullets()
        story.append(Paragraph(esc(line), h1))
        continue
    # bullet line
    if line.startswith("- "):
        pending_bullets.append(line[2:])
        continue
    # numbered list item within demonstration / next steps
    m = re.match(r"^(\d+)\.\s+(.*)", line)
    if m and len(line) > 70:
        flush_bullets()
        story.append(Paragraph(f"<b>{m.group(1)}.</b> {esc(m.group(2))}", body))
        continue
    flush_bullets()
    story.append(Paragraph(esc(line), body))

flush_bullets()


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.85 * inch, 0.5 * inch, "RallyPoint — Milestone 1 Reflection")
    canvas.drawRightString(letter[0] - 0.85 * inch, 0.5 * inch, f"Page {doc.page}")
    canvas.restoreState()


doc = SimpleDocTemplate(
    OUT, pagesize=letter,
    leftMargin=0.85 * inch, rightMargin=0.85 * inch,
    topMargin=0.8 * inch, bottomMargin=0.8 * inch,
    title="RallyPoint — Milestone 1 Reflection", author="Phoebe Wang",
)
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print("wrote", OUT)
