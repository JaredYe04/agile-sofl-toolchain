cd /d %~dp0

call npm run build --workspace @agile-sofl/parser

call npm run build --workspace @agile-sofl/language-server

call npm run bundle --workspace @agile-sofl/language-server

call npm run build --workspace @agile-sofl/editor-api

cd packages\studio

call npm run bundle:parse-bridge

npm run dev

