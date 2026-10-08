/**
 * あそぶ人のレベルと、レベルごとの手加減。
 * レベルは1人ずつ選ぶ。親と子が同じゲームで、手加減なしで勝負できるようにするための表。
 * 数値は実機で遊んで調整する。
 */
export type Level = 'chibi' | 'kids' | 'otona' | 'senshu'

export const LEVELS: Level[] = ['chibi', 'kids', 'otona', 'senshu']

/** 0＝下の人、1＝上の人（上の人の画面は180°回して見せる） */
export type Side = 0 | 1

export interface LevelInfo {
  label: string
  mark: string
  hint: string
  /** ラケットの幅（m）。コートの幅は 6.10m */
  paddleWidth: number
  /** 自分に向かってくる球の速さ（1＝ふつう）。2026-10-06 本人の試遊で「ちょっと速い」→ 全体を約2割遅くした */
  ballSpeed: number
  /** ラケットを球の方へ吸い寄せる強さ（0〜1） */
  assist: number
  /** 強く打っても外に出ないようにする（小さい子はアウトで終わらないように） */
  keepIn: boolean
  /** 早押しで、押した時刻に足す遅れ（ms） */
  pressDelay: number
  /** 早押しのお題の種類 */
  task: 'flash' | 'line'
  /** クイズの問題 */
  quiz: 'kids' | 'player'
  /** クイズで出す難しさの上限（1〜3） */
  quizMax: number
}

export const LEVEL_INFO: Record<Level, LevelInfo> = {
  chibi: {
    label: 'ちびっこ',
    mark: '🐣',
    hint: '3〜6さい',
    paddleWidth: 2.6,
    ballSpeed: 0.45,
    assist: 0.55,
    keepIn: true,
    pressDelay: 0,
    task: 'flash',
    quiz: 'kids',
    quizMax: 1,
  },
  kids: {
    label: 'キッズ',
    mark: '🧒',
    hint: 'しょうがくせい',
    paddleWidth: 2.0,
    ballSpeed: 0.6,
    assist: 0.2,
    keepIn: true,
    pressDelay: 100,
    task: 'flash',
    quiz: 'kids',
    quizMax: 2,
  },
  otona: {
    label: 'おとな',
    mark: '🧑',
    hint: 'はじめての人',
    paddleWidth: 1.4,
    ballSpeed: 0.8,
    assist: 0,
    keepIn: false,
    pressDelay: 250,
    task: 'line',
    quiz: 'player',
    quizMax: 2,
  },
  senshu: {
    label: 'せんしゅ',
    mark: '🏆',
    hint: 'ソフトテニスをしている人',
    paddleWidth: 1.1,
    ballSpeed: 0.95,
    assist: 0,
    keepIn: false,
    pressDelay: 400,
    task: 'line',
    quiz: 'player',
    quizMax: 3,
  },
}

export const SIDE_NAME: Record<Side, string> = { 0: 'オレンジ', 1: 'あお' }
export const SIDE_COLOR: Record<Side, string> = { 0: '#ff8a3d', 1: '#3d9be9' }

export const other = (s: Side): Side => (s === 0 ? 1 : 0)
