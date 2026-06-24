import React, { useState } from 'react'
import {
  generateDiagnosis,
  getApiKey,
  setApiKey,
  hasApiKey
} from '../lib/aiDiagnosis.js'

// 규칙 기반 추천 위에 얹는 LLM(Claude) 자연어 진단 패널.
// 사용자가 자신의 Anthropic API 키를 입력하면 브라우저에서 직접 호출한다.
export default function AiDiagnosis({ site, rec, complaints = [] }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [keyInput, setKeyInput] = useState(getApiKey())

  // 사이트가 바뀌면 이전 진단 초기화
  const [lastId, setLastId] = useState(site?.id)
  if (site?.id !== lastId) {
    setLastId(site?.id)
    setText('')
    setError('')
  }

  async function run() {
    setError('')
    if (!hasApiKey()) {
      setShowKey(true)
      return
    }
    setBusy(true)
    try {
      const out = await generateDiagnosis(site, rec, complaints)
      setText(out)
    } catch (e) {
      if (e.message === 'NO_KEY') setShowKey(true)
      else setError(e.message || '생성 실패')
    } finally {
      setBusy(false)
    }
  }

  function saveKey() {
    setApiKey(keyInput)
    setShowKey(false)
    if (keyInput.trim()) run()
  }

  return (
    <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-800">
          <span>✨ AI 자연어 진단</span>
          <span className="rounded-sm bg-indigo-100 px-1 py-px text-[9px] font-medium text-indigo-600">
            Claude Opus 4.8
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowKey((v) => !v)}
            className="text-[10px] text-indigo-500 underline hover:text-indigo-700"
          >
            {hasApiKey() ? 'API 키 변경' : 'API 키 설정'}
          </button>
          <button
            onClick={run}
            disabled={busy}
            className="rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? '생성 중…' : text ? '다시 생성' : 'AI 진단 생성'}
          </button>
        </div>
      </div>

      {showKey && (
        <div className="mt-2 rounded-md border border-indigo-200 bg-white p-2">
          <div className="text-[10px] text-slate-500">
            Anthropic API 키 (sk-ant-…). 브라우저 localStorage에만 저장되며 서버로
            전송되지 않습니다.
          </div>
          <div className="mt-1.5 flex gap-1.5">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-ant-..."
              className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-indigo-500"
            />
            <button
              onClick={saveKey}
              className="rounded bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700"
            >
              저장
            </button>
          </div>
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-[10px] text-indigo-500 underline"
          >
            키 발급 (console.anthropic.com)
          </a>
        </div>
      )}

      {error && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
          {error}
        </div>
      )}

      {text && (
        <div className="mt-2 whitespace-pre-wrap rounded-md border border-indigo-100 bg-white px-3 py-2 text-[13px] leading-relaxed text-slate-800">
          {text}
        </div>
      )}

      {!text && !error && !showKey && (
        <div className="mt-1.5 text-[10px] text-slate-400">
          규칙 기반 6요인 점수를 근거로 Claude가 담당자용 진단·우선조치를 자연어로
          생성합니다.
        </div>
      )}
    </div>
  )
}
