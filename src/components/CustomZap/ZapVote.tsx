import { useIntl } from '@cookbook/solid-intl';
import { Component, createEffect, createSignal, For, Match, on, Show, Switch } from 'solid-js';
import { defaultZapOptions, Kind } from '../../constants';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { hookForDev } from '../../lib/devTools';
import { zapArticle, zapDVM, zapNote, zapProfile, zapStream, zapVote } from '../../lib/zap';
import { userName } from '../../stores/profile';
import { toastZapFail, zapCustomOption, actions as tActions, placeholders as tPlaceholders, zapCustomAmount } from '../../translations';
import { PrimalDVM, PrimalNote, PrimalUser, PrimalUserPoll, ZapOption } from '../../types/primal';
import AdvancedSearchDialog from '../AdvancedSearch/AdvancedSearchDialog';
import ButtonPrimary from '../Buttons/ButtonPrimary';
import { lottieDuration } from '../Note/NoteFooter/NoteFooter';
import TextInput from '../TextInput/TextInput';
import { useToastContext } from '../Toaster/Toaster';

import styles from './CustomZap.module.scss';
import { readSecFromStorage } from '../../lib/localStore';
import { StreamingData } from '../../lib/streaming';
import { accountStore, hasPublicKey, setShowPin, showGetStarted } from '../../stores/accountStore';
import { VoteZapInfo } from '../../contexts/AppContext';
import { sendUserPollVote } from '../../lib/notes';
import { humanizeNumber } from '../../lib/stats';

const ZapVote: Component<{
  id?: string,
  open?: boolean,
  config?: VoteZapInfo | undefined,
}> = (props) => {

  const toast = useToastContext();
  const intl = useIntl();
  const settings = useSettingsContext();

  const [selectedValue, setSelectedValue] = createSignal<ZapOption>({ amount: props.config?.poll.zapLimits?.min || 0});
  const [customAmount, setCustomAmount] = createSignal('');
  const [comment, setComment] = createSignal('');

  createEffect(on(() => props.open, (open) => {
    if (open) {
      setSelectedValue({ amount: props.config?.poll.zapLimits?.min || 0});
    }
  }))

  const zapRange = (): ZapOption[] => {
    const poll = props.config?.poll;
    if (!poll) return [];

    const min = poll.zapLimits?.min || 1;
    const max = poll.zapLimits?.max || 21_000;

    let options = 6;


    if (max - min < 6) options = max - min + 1;


    if (options <= 1) {
      return [{ amount: min }];
    }

    if (options === 2) {
      return [{ amount: min }, { amount: max}];
    }

    const r = Array.from({ length: options }, (_, i) => Math.round(min + (i * (max - min)) / (options - 1))).map(amount => ({
      amount,
    }));

    return r;
  }

  const isSelected = (value: ZapOption) => {
    const sel = selectedValue();
    return value.amount === sel.amount;
  };

  const updateCustomAmount = (value: string) => {
    const amount = parseInt(value.replaceAll(',', ''));

    if (isNaN(amount)) return;

    setCustomAmount(value);
  };


  const truncateNumber = (amount: number) => {
    const t = 1000;

    if (amount < t) {
      return `${amount}`;
    }

    if (amount < Math.pow(t, 2)) {
      return (amount % t === 0) ?
        `${Math.floor(amount / t)}K` :
        intl.formatNumber(amount);
    }

    if (amount < Math.pow(t, 3)) {
      return (amount % t === 0) ?
        `${Math.floor(amount / Math.pow(t, 2))}M` :
        intl.formatNumber(amount);
    }

    if (amount < Math.pow(t, 4)) {
      return (amount % t === 0) ?
        `${Math.floor(amount / Math.pow(t, 3))}B` :
        intl.formatNumber(amount);
    }

    if (amount < Math.pow(t, 5)) {
      return (amount % t === 0) ?
        `${Math.floor(amount / Math.pow(t, 3))}T` :
        intl.formatNumber(amount);
    }

    return intl.formatNumber(amount);
  };

  const isZapInLimit = (amount: number) => {
    const min = props.config?.poll.zapLimits?.min || 0;
    const max = props.config?.poll.zapLimits?.max || 0;

    return amount >= min && (max === 0 || (amount <= max));
  }

  const submit = async () => {
    if (!hasPublicKey()) {
      showGetStarted();
      return;
    }

    if (!accountStore.sec || accountStore.sec.length === 0) {
      const sec = readSecFromStorage();
      if (sec) {
        setShowPin(sec);
        return;
      }
    }

    props.config?.onConfirm(selectedValue());

    const poll = props.config?.poll;
    const choice = props.config?.choice;

    if (!poll || !choice) return;

    const min = poll.zapLimits?.min || 0;

    const cAmount = parseInt(customAmount());

    const amount = !isNaN(cAmount) && isZapInLimit(cAmount) ?
      cAmount :
      selectedValue().amount || min;

    const success = await zapVote(
      poll,
      accountStore.publicKey,
      amount,
      choice.id,
      comment(),
      accountStore.activeNWC,
    );

    handleZap(success);
  };

  const handleZap = (success = true) => {
    if (success) {
      props.config?.onSuccess(selectedValue());
      return;
    }

    toast?.sendWarning(
      intl.formatMessage(toastZapFail),
    );

    props.config?.onFail(selectedValue());
  };

  let md = false;

  const gridClass = () => {
    if (zapRange().length === 1) return styles.singleOption;
    if (zapRange().length === 2) return styles.doubleOption;
    if (zapRange().length === 3) return styles.tripleOption;
    if (zapRange().length === 4) return styles.quadrupleOption;

    return '';
  }

  const isVotingDisabled = () => {
    const cAmount = parseInt(customAmount());
    if (isNaN(cAmount)) return !isZapInLimit(selectedValue().amount || props.config?.poll.zapLimits?.min || 0);

    return !isZapInLimit(cAmount);
  }

  const canHaveCustomAmount = () => {
    if (zapRange().length < 6) return false;

    const min = props.config?.poll.zapLimits?.min || 0;
    const max = props.config?.poll.zapLimits?.max || 0;

    return max - min > 6;
  }

  return (
    <AdvancedSearchDialog
      open={props.open}
      setOpen={(isOpen: boolean) => {
        if (isOpen) return;

        if (md) {
          md = false;
        }
        else {
          props.config?.onCancel({ amount: 0 });
        }
      }}
      title={
        <div class={styles.title}>
          <div class={styles.caption}>
            {intl.formatMessage(tActions.vote)}
          </div>
        </div>
      }
      triggerClass={styles.hidden}
    >
      <div
        id={props.id}
        class={styles.customZap}
        onMouseUp={() => md = false}
        onMouseDown={() => md = true}
        onClick={(e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >

        <div class={styles.description}>
          <span>Zap</span>
          <span class={styles.amount}>
            <Show
              when={isNaN(parseInt(customAmount()))}
              fallback={<>{truncateNumber(parseInt(customAmount()))}</>}
            >
              {truncateNumber(selectedValue().amount || 0)}
            </Show>
          </span>
          <span class={styles.units}>sats</span>
        </div>

        <div class={`${styles.options} ${gridClass()}`}>
          <For each={zapRange()}>
            {(range) =>
              <button
                class={`${styles.zapOption} ${isSelected(range) ? styles.selected : ''}`}
                onClick={() => {
                  setSelectedValue(() => range);
                  setCustomAmount('');
                }}
              >
                <div>
                  <span class={styles.amount}>
                    {truncateNumber(range.amount || 0)}
                  </span>
                  <span class={styles.sats}>sats</span>
                </div>
              </button>
            }
          </For>
        </div>

        <div class={`${styles.limits} ${zapRange().length === 1 ? styles.topMargin : ''}`}>
          <Show
            when={zapRange().length > 1}
            fallback={<>This poll only allows votes of {humanizeNumber(zapRange()[0].amount || 0)} sats</>}
          >
            This poll allows votes between {humanizeNumber(zapRange()[0].amount || 0)} - {humanizeNumber(zapRange()[zapRange().length - 1].amount || 0)} sats
          </Show>
        </div>

        <Show when={canHaveCustomAmount()}>
          <TextInput
            name="customAmountInput"
            type="text"
            value={customAmount()}
            placeholder="enter custom amount"
            onChange={updateCustomAmount}
            noExtraSpace={true}
          />
          <div class={styles.spacer}></div>
        </Show>

        <TextInput
          type="text"
          value={comment()}
          placeholder={intl.formatMessage(tPlaceholders.addComment)}
          onChange={setComment}
          noExtraSpace={true}
        />

        <div
          class={styles.action}
        >
          <ButtonPrimary
            onClick={submit}
            disabled={isVotingDisabled()}
          >
            <div class={styles.caption}>
              Vote
            </div>
          </ButtonPrimary>
        </div>

      </div>
    </AdvancedSearchDialog>
  );
}

export default hookForDev(ZapVote);
