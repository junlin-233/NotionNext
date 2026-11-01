#!/usr/bin/env bash
# 重新生成 OG 分享卡字体（当需要扩充字符集时执行）
# 依赖：python + fonttools（pip install fonttools brotli）
# 产物：public/fonts/og-title.ttf（约 780KB，覆盖 GB2312 一级字 + ASCII + 中文标点）
set -euo pipefail
cd "$(dirname "$0")/.."

SRC_URL="https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/SubsetOTF/SC/NotoSansSC-Medium.otf"
SRC="public/fonts/.src-noto-sans-sc-medium.otf"

echo "[og-font] 下载源字体..."
curl -sL --max-time 300 -o "$SRC" "$SRC_URL"

echo "[og-font] 生成字符集..."
python - <<'PY'
chars = set()
for high in range(0xB0, 0xD8):
    for low in range(0xA1, 0xFF):
        try:
            chars.add(bytes([high, low]).decode('gb2312'))
        except Exception:
            pass
chars.update(chr(c) for c in range(0x20, 0x7F))
chars.update('、。，．！？：；“”‘’（）《》【】〔〕—…·～￥％＋－×÷＝＜＞「」『』〈〉')
for c in range(0xFF01, 0xFF5F):
    chars.add(chr(c))
with open('.og-charset.txt', 'w', encoding='utf-8') as f:
    f.write(''.join(sorted(chars)))
print(f'  字符数: {len(chars)}')
PY

echo "[og-font] 子集化..."
python -m fontTools.subset "$SRC" \
  --text-file=.og-charset.txt \
  --output-file=public/fonts/og-title.ttf \
  --no-hinting --layout-features='' --drop-tables+=DSIG --desubroutinize

rm -f "$SRC" .og-charset.txt
echo "[og-font] 完成: public/fonts/og-title.ttf"
ls -lh public/fonts/og-title.ttf
