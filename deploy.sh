#!/bin/sh
# 앱 파일만 골라 Firebase Hosting(https://my-lingq.web.app)에 올림.
# data/(개인 학습 데이터)·netflix-extension/ 등은 복사 목록에 없으므로 절대 올라가지 않음.
set -e
cd "$(dirname "$0")"
rm -rf .deploy && mkdir .deploy
cp -R index.html sw.js manifest.webmanifest icons img .deploy/
~/.local/fb/node_modules/.bin/firebase deploy --only hosting --project travel-planner-2d036 --non-interactive
