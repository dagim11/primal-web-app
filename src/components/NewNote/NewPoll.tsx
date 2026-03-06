import { Component, createEffect, For, on, onMount, Show } from "solid-js";
import { TextField } from "@kobalte/core/text-field";
import { getNowTimestamp } from "../../lib/dates";
import { SetStoreFunction } from "solid-js/store";
import { uuidv4 } from "../../utils";
import HelpTip from "../HelpTip/HelpTip";
import AdvancedSearchSelectBox from "../AdvancedSearch/AdvancedSearchSelect";

import styles from  "./NewPoll.module.scss";
import { Kind } from "../../constants";
import { PrimalPollChoice } from "../../types/primal";


export type PollLength = {
  days: string,
  hours: string,
  minutes: string,
}

export type PollState = {
  question: string,
  options: PrimalPollChoice[],
  pollKind: Kind.UserPoll | Kind.ZapPoll,
  pollType: 'singlechoice' | 'multiplechoice',
  endsAt: number,
  pollLength: PollLength,
  zapLimits: { min: number, max: number },

  focusedInput: string,
  externalInput: string,
}

export const emptyPoll = (): PollState => ({
  question: '',
  options: [
    { id: uuidv4(), label: '', index: 0},
    { id: uuidv4(), label: '', index: 1},
  ],
  pollKind: Kind.UserPoll,
  pollType: 'singlechoice',
  endsAt: getNowTimestamp(),
  pollLength: { days: '1 days', hours: '0 hours', minutes: '0 minutes' },
  zapLimits: { min: 10, max: 100 },

  focusedInput: '',
  externalInput: '',
})

export const POLL_ANSWER_LIMIT = 25;

export const POLL_LEGTH_OPTIONS = {
  days: Array.from({ length: 32 }, (_, i) => 0 + i).map(i => `${i} days`),
  hours: Array.from({ length: 24 }, (_, i) => 0 + i).map(i => `${i} hours`),
  minutes: Array.from({ length: 60 }, (_, i) => 0 + i).map(i => `${i} minutes`),
}

export const calculateEndTimestamp = (pollLength: PollLength) => {
  let days = parseInt(pollLength.days.split(' ')[0]);
  let hours = parseInt(pollLength.hours.split(' ')[0]);
  let minutes = parseInt(pollLength.minutes.split(' ')[0]);

  if (isNaN(days)) days = 0;
  if (isNaN(hours)) hours = 0;
  if (isNaN(minutes)) minutes = 0;

  const seconds = minutes * 60 + hours * 60 * 60 + days * 24 * 60 * 60;

  const timestamp = getNowTimestamp() + seconds;

  return timestamp
}

export const getPollInput = (focusedInput: string) => {
  return document.documentElement.querySelector(`[data-input-id=${focusedInput}]`) as HTMLTextAreaElement | HTMLInputElement | undefined;
}

const NewPoll: Component<{
  onRemovePoll: () => void,
  pollState: PollState,
  setPollState: SetStoreFunction<PollState>,
}> = (props) => {
  // const [focusedOption, props.setPollState]'focusedChoice',  = createSignal(-1);

  const addChoice = () => {
    props.setPollState('options', props.pollState.options.length, () => ({ id: uuidv4(), label: '' }))
  }

  const removeChoice = (option: PrimalPollChoice) => {
    if (props.pollState.options.length <= 2) return;
    props.setPollState('options', (options) => options.filter(o => option.id !== o.id));
  }

  let minZapLimit: HTMLInputElement | undefined;
  let maxZapLimit: HTMLInputElement | undefined;

  // const [focusedLimit, props.setPollState]'foucusedZapLimit',  = createSignal('');

  createEffect(on(() => props.pollState.externalInput, (ext) => {
    if (ext.length === 0) return;

    const input = document.querySelector(`[data-input-id=${props.pollState.focusedInput}]`) as HTMLInputElement | HTMLTextAreaElement;
    if (!input) return;

    let msg = input.value;


    let cursor = input.selectionStart;

    if (cursor === null) return;

    const value = msg.slice(0, cursor) + `${ext} ` + msg.slice(cursor);

    input.value = value;

    // Calculate new cursor position
    input.selectionEnd = cursor + 3;
    input.focus();
    props.setPollState('externalInput', '');
  }));

  onMount(() => {
    const input = document.documentElement.querySelector('[data-input-id=question') as HTMLInputElement | HTMLTextAreaElement;

    input?.focus();
  })

  return (
    <div class={styles.newPoll}>
      <TextField
        value={props.pollState.question}
        onChange={v => props.setPollState('question', v)}
      >
        <TextField.TextArea
          class={styles.questionInput}
          autoResize
          rows={1}
          placeholder="Ask a question..."
          onFocus={() => props.setPollState('focusedInput', 'question')}
          data-input-id="question"
        />
      </TextField>

      <div class={styles.optionsList}>
        <For each={props.pollState.options}>
          {(option, index) => (
            <div
              class={styles.pollOption}
              data-focused={index() === parseInt((props.pollState.focusedInput.split('-') || [])[1])}
            >
              <TextField
                value={option.label}
                onChange={v => {
                  if (v.length > POLL_ANSWER_LIMIT) return;
                  props.setPollState(
                    'options',
                    opt => opt.id === option.id,
                    'label',
                    v,
                  );
                }}
              >
                <TextField.Label class={styles.optionCaption}>
                  <div
                    class={styles.captionLabel}
                    data-focused={index() === parseInt((props.pollState.focusedInput.split('-') || [])[1])}
                  >
                    Choice {index() + 1}
                  </div>
                  <div
                    class={styles.charCounter}
                    data-focused={index() === parseInt((props.pollState.focusedInput.split('-') || [])[1])}
                  >
                    {option.label.length}/{POLL_ANSWER_LIMIT}
                  </div>
                </TextField.Label>
                <div class={styles.optionInputLayout}>
                  <TextField.Input
                    class={styles.optionInput}
                    data-input-id={`choice-${index()}`}
                    onFocus={() => props.setPollState('focusedInput', `choice-${index()}`)}
                    // onFocus={() => setTimeout(() => props.setPollState('focusedChoice', index()), 10)}
                    // onBlur={() => props.setPollState('focusedChoice', -1)}
                  />
                  <button
                    class={styles.removeOption}
                    data-focused={index() === parseInt((props.pollState.focusedInput.split('-') || [])[1])}
                    onClick={() => {
                      removeChoice(option)
                    }}
                  >
                    <div class={styles.removeIcon}></div>
                    <span>Remove</span>
                  </button>
                </div>
              </TextField>
            </div>
          )}
        </For>

        <button
          class={styles.addChoice}
          onClick={addChoice}
        >
          <div class={styles.addIcon}></div>
          <span>Add choice</span>
        </button>
      </div>

      <div class={styles.separator}></div>

      <div class={styles.pollTypeList}>
        <div class={styles.pollTypeCaption}>
          <span>Poll type</span>
          <HelpTip>
            <div class={styles.pollHelp}>
              <div>
                <b>User poll</b>: one poll per user
              </div>
              <div>
                <b>Zap poll</b>: One zap vote per user. Option with the highest total sats wins. You can set minimum and maximum zap amounts per vote. Set them equal if you want every vote to carry the same weight.
              </div>
            </div>
          </HelpTip>
        </div>

        <div class={styles.pollTypeOptions}>
          <button
            class={styles.pollType}
            data-selected={props.pollState.pollKind === Kind.UserPoll}
            onClick={() => props.setPollState('pollKind', Kind.UserPoll)}
          >
            <div class={styles.userIcon}></div>
            <span>User Poll</span>
          </button>
          <button
            class={styles.pollType}
            data-selected={props.pollState.pollKind === Kind.ZapPoll}
            onClick={() => props.setPollState('pollKind', Kind.ZapPoll)}
          >
            <div class={styles.zapIcon}></div>
            <span>Zap Poll</span>
          </button>
        </div>

        <Show when={props.pollState.pollKind === Kind.ZapPoll}>
          <div class={styles.pollTypeCaption}>
            <span>Zap limits</span>
          </div>

          <div class={styles.pollZapLimits}>
            <TextField
              class={styles.limitInputWrapper}
              value={`${props.pollState.zapLimits.min}`}
              data-focused={props.pollState.focusedInput === 'limit-min'}
              onChange={v => {
                const num = parseInt(v);
                if (isNaN(num))return;

                props.setPollState(
                  'zapLimits',
                  'min',
                  num,
                );
              }}
              onClick={() => {
                minZapLimit?.focus();
              }}
            >
              <TextField.Input
                class={styles.limitInput}
                ref={minZapLimit}
                data-input-id="limit-min"
                onFocus={() => props.setPollState('focusedInput', 'limit-min')}
                // onFocus={() => setTimeout(() => props.setPollState('foucusedZapLimit', 'min'), 10)}
                // onBlur={() => props.setPollState('foucusedZapLimit', '')}
              />
              <div class={styles.zapUnit}>sats</div>
              <div class={styles.limitType}>Minimum</div>
            </TextField>

            <TextField
              class={styles.limitInputWrapper}
              value={`${props.pollState.zapLimits.max}`}
              data-focused={props.pollState.focusedInput === 'limit-max'}
              onChange={v => {
                const num = parseInt(v);
                if (isNaN(num))return;

                props.setPollState(
                  'zapLimits',
                  'max',
                  num,
                );
              }}
              onClick={() => {
                maxZapLimit?.focus();
              }}
            >
              <TextField.Input
                class={styles.limitInput}
                ref={maxZapLimit}
                data-input-id="limit-max"
                onFocus={() => props.setPollState('focusedInput', 'limit-max')}
                // onFocus={() => setTimeout(() => props.setPollState('foucusedZapLimit', 'max'), 10)}
                // onBlur={() => props.setPollState('foucusedZapLimit', '')}
              />
              <div class={styles.zapUnit}>sats</div>
              <div class={styles.limitType}>Maximum</div>
            </TextField>
          </div>
        </Show>
      </div>

      <div class={styles.separator}></div>

      <div class={styles.pollLengthSettings}>
        <div class={styles.pollLengthCaption}>
          Poll length
        </div>

        <div class={styles.pollLengthOptions}>
          <AdvancedSearchSelectBox
            value={props.pollState.pollLength.days}
            options={POLL_LEGTH_OPTIONS.days}
            onChange={(v) => {
              props.setPollState('pollLength', 'days', v);
            }}
          />

          <AdvancedSearchSelectBox
            value={props.pollState.pollLength.hours}
            options={POLL_LEGTH_OPTIONS.hours}
            onChange={(v) => {
              props.setPollState('pollLength', 'hours', v);
            }}
          />

          <AdvancedSearchSelectBox
            value={props.pollState.pollLength.minutes}
            options={POLL_LEGTH_OPTIONS.minutes}
            onChange={(v) => {
              props.setPollState('pollLength', 'minutes', v);
            }}
          />
        </div>
      </div>

      <div class={styles.separator}></div>

      <div class={styles.additionalActions}>
        <button onClick={props.onRemovePoll}>
          <div class={styles.deleteIcon}></div>
          <span>Remove poll</span>
        </button>
      </div>
    </div>
  )
}

export default NewPoll;
