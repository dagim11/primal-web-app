import { Component, createSignal, For, Show } from "solid-js";
import { TextField } from "@kobalte/core/text-field";
import { getNowTimestamp } from "../../lib/dates";
import { createStore, SetStoreFunction } from "solid-js/store";
import { uuidv4 } from "../../utils";
import HelpTip from "../HelpTip/HelpTip";
import AdvancedSearchSelectBox from "../AdvancedSearch/AdvancedSearchSelect";

import styles from  "./NewPoll.module.scss";
import { Kind } from "../../constants";

export type PollOption = {
  id: string,
  label: string,
}

export type PollLength = {
  days: string,
  hours: string,
  minutes: string,
}

export type PollState = {
  question: string,
  options: PollOption[],
  pollKind: Kind.UserPoll | Kind.ZapPoll,
  pollType: 'singlechoice' | 'multiplechoice',
  endsAt: number,
  pollLength: PollLength,
  zapLimits: { min: number, max: number }
}

export const emptyPoll = (): PollState => ({
  question: '',
  options: [
    { id: uuidv4(), label: ''},
    { id: uuidv4(), label: ''},
  ],
  pollKind: Kind.UserPoll,
  pollType: 'singlechoice',
  endsAt: getNowTimestamp(),
  pollLength: { days: '0 days', hours: '0 hours', minutes: '0 minutes' },
  zapLimits: { min: 10, max: 100 }
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

const NewPoll: Component<{
  onRemovePoll: () => void,
  pollState: PollState,
  setPollState: SetStoreFunction<PollState>,
}> = (props) => {
  const [focusedOption, setFocusedOption] = createSignal(-1);

  const addChoice = () => {
    props.setPollState('options', props.pollState.options.length, () => ({ id: uuidv4(), label: '' }))
  }

  const removeChoice = (option: PollOption) => {
    if (props.pollState.options.length <= 2) return;
    props.setPollState('options', (options) => options.filter(o => option.id !== o.id));
  }

  let minZapLimit: HTMLInputElement | undefined;
  let maxZapLimit: HTMLInputElement | undefined;

  const [focusedLimit, setFocusedLimit] = createSignal('');

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
        />
      </TextField>

      <div class={styles.optionsList}>
        <For each={props.pollState.options}>
          {(option, index) => (
            <div
              class={styles.pollOption}
              data-focused={index() === focusedOption()}
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
                    data-focused={index() === focusedOption()}
                  >
                    Choice {index() + 1}
                  </div>
                  <div
                    class={styles.charCounter}
                    data-focused={index() === focusedOption()}
                  >
                    {option.label.length}/{POLL_ANSWER_LIMIT}
                  </div>
                </TextField.Label>
                <div class={styles.optionInputLayout}>
                  <TextField.Input
                    class={styles.optionInput}
                    onFocus={() => setTimeout(() => setFocusedOption(index()), 10)}
                    onBlur={() => setFocusedOption(-1)}
                  />
                  <button
                    class={styles.removeOption}
                    data-focused={index() === focusedOption()}
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
              data-focused={focusedLimit() === 'min'}
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
                onFocus={() => setTimeout(() => setFocusedLimit('min'), 10)}
                onBlur={() => setFocusedLimit('')}
              />
              <div class={styles.zapUnit}>sats</div>
              <div class={styles.limitType}>Minimum</div>
            </TextField>

            <TextField
              class={styles.limitInputWrapper}
              value={`${props.pollState.zapLimits.max}`}
              data-focused={focusedLimit() === 'max'}
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
                onFocus={() => setTimeout(() => setFocusedLimit('max'), 10)}
                onBlur={() => setFocusedLimit('')}
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
