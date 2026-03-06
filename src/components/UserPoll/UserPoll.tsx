import { batch, Component, createSignal, For, Match, onMount, Show, Switch } from "solid-js";
import { hookForDev } from "../../lib/devTools";

import styles from './UserPoll.module.scss';
import { PrimalPollChoice, PrimalUserPoll, ZapOption } from "../../types/primal";
import { CustomZapInfo, useAppContext } from "../../contexts/AppContext";
import Avatar from "../Avatar/Avatar";
import NoteAuthorInfo from "../Note/NoteAuthorInfo";
import ParsedNote from "../ParsedNote/ParsedNote";
import ParsedPoll from "../ParsedNote/ParsedPoll";
import { sendUserPollVote } from "../../lib/notes";
import { dateFuture } from "../../lib/dates";
import { now, uuidv4 } from "../../utils";
import { humanizeNumber } from "../../lib/stats";
import NoteTopZapsCompact from "../Note/NoteTopZapsCompact";
import { createStore } from "solid-js/store";
import { NoteReactionsState } from "../Note/Note";
import NoteFooter from "../Note/NoteFooter/NoteFooter";
import { accountStore } from "../../stores/accountStore";
import { useThreadContext } from "../../contexts/ThreadContext";
import { useSettingsContext } from "../../contexts/SettingsContext";
import NoteContextTrigger from "../Note/NoteContextTrigger";

export type UserPollProps = {
  id: string,
  poll: PrimalUserPoll
  hideContext?: boolean,
  onRemove?: (id: string, isRepost?: boolean) => void,
}

const UserPoll: Component<UserPollProps> = (props) => {

  const app = useAppContext();
  const threadContext = useThreadContext();
  const settings = useSettingsContext();

  const [reactionsState, updateReactionsState] = createStore<NoteReactionsState>({
    likes: props.poll.stats?.likes || 0,
    liked: props.poll.noteActions.liked,
    reposts: props.poll.stats?.reposts || 0,
    reposted: props.poll.noteActions.reposted,
    replies: props.poll.stats?.replies || 0,
    replied: props.poll.noteActions.replied,
    zapCount: props.poll.stats?.zaps || 0,
    satsZapped: props.poll.stats?.satszapped || 0,
    zapped: props.poll.noteActions.zapped,
    zappedAmount: 0,
    zappedNow: false,
    isZapping: false,
    showZapAnim: false,
    hideZapIcon: false,
    moreZapsAvailable: false,
    isRepostMenuVisible: false,
    topZaps: [],
    topZapsFeed: [],
    quoteCount: 0,
  });

  let noteContextMenu: HTMLDivElement | undefined;

  let latestTopZap: string = '';
  let latestTopZapFeed: string = '';

  const [didVote, setDidVote] = createSignal(false);

  const doVote = (choice: PrimalPollChoice) => {
    sendUserPollVote(props.poll, choice);
    setDidVote(true);
    console.log('VOTED: ', didVote())
  }

  const totalVotes = () => {
    if (!props.poll.results) return 0;
    const choices = Object.keys(props.poll.results);

    return choices.reduce<number>((acc, id) => {
      return acc + (props.poll.results[id]?.votes || 0);
    }, 0) + (didVote() ? 1 : 0)
  }

  const isExpiring = () => {
    return props.poll.endsAt > (props.poll.msg.created_at || 0)
  }

  const isExpired = () => {
    return props.poll.endsAt < now();
  }

  const choicePercent = (id: string) => {
    const result = props.poll.results[id].votes;
    const total = totalVotes();

    return ((result/total)*100).toFixed(1);
  }

  const winner = () => {
    const choices = Object.keys(props.poll.results);

    return choices.reduce<[string, number]>((acc, id) => {
      const votes = props.poll.results[id]?.votes || 0;
      return votes >= acc[1] ? [id, votes] : acc;
    }, ['', 0])
  }

  const hasVotedFor = (id: string) => {
    return didVote() || (props.poll.noteActions.voted_for_option === id);
  }

  const showVoteDetails = () => {
    app?.actions.openVotesModal(props.poll);
  }

  onMount(() => {
    updateReactionsState('topZapsFeed', () => [ ...(props.poll.topZaps || [])]);
  })


  const customZapInfo: () => CustomZapInfo = () => ({
    note: props.poll,
    onConfirm: onConfirmZap,
    onSuccess: onSuccessZap,
    onFail: onFailZap,
    onCancel: onCancelZap,
  });

  const onConfirmZap = (zapOption: ZapOption) => {
    app?.actions.closeCustomZapModal();
    batch(() => {
      updateReactionsState('zappedAmount', () => zapOption.amount || 0);
      updateReactionsState('satsZapped', (z) => z + (zapOption.amount || 0));
      updateReactionsState('zapped', () => true);
      updateReactionsState('showZapAnim', () => true)
    });

    addTopZap(zapOption);
    addTopZapFeed(zapOption)
  };

    const onSuccessZap = (zapOption: ZapOption) => {
      app?.actions.closeCustomZapModal();
      app?.actions.resetCustomZap();

      const pubkey = accountStore.publicKey;

      if (!pubkey) return;

      batch(() => {
        updateReactionsState('zapCount', (z) => z + 1);
        updateReactionsState('isZapping', () => false);
        updateReactionsState('showZapAnim', () => false);
        updateReactionsState('hideZapIcon', () => false);
        updateReactionsState('zapped', () => true);
      });
    };

  const onFailZap = (zapOption: ZapOption) => {
    app?.actions.closeCustomZapModal();
    app?.actions.resetCustomZap();
    batch(() => {
      updateReactionsState('zappedAmount', () => -(zapOption.amount || 0));
      updateReactionsState('satsZapped', (z) => z - (zapOption.amount || 0));
      updateReactionsState('isZapping', () => false);
      updateReactionsState('showZapAnim', () => false);
      updateReactionsState('hideZapIcon', () => false);
      updateReactionsState('zapped', () => props.poll.noteActions.zapped);
    });

    removeTopZap(zapOption);
    removeTopZapFeed(zapOption);
  };

  const onCancelZap = (zapOption: ZapOption) => {
    app?.actions.closeCustomZapModal();
    app?.actions.resetCustomZap();
    batch(() => {
      updateReactionsState('zappedAmount', () => -(zapOption.amount || 0));
      updateReactionsState('satsZapped', (z) => z - (zapOption.amount || 0));
      updateReactionsState('isZapping', () => false);
      updateReactionsState('showZapAnim', () => false);
      updateReactionsState('hideZapIcon', () => false);
      updateReactionsState('zapped', () => props.poll.noteActions.zapped);
    });

    removeTopZap(zapOption);
    removeTopZapFeed(zapOption);
  };

  const addTopZapFeed = (zapOption: ZapOption) => {
    const pubkey = accountStore.publicKey;

    if (!pubkey) return;

    const oldZaps = [ ...reactionsState.topZapsFeed ];

    latestTopZapFeed = uuidv4() as string;

    const newZap = {
      amount: zapOption.amount || 0,
      message: zapOption.message || '',
      pubkey,
      eventId: props.poll.id,
      id: latestTopZapFeed,
    };

    const zaps = [ ...oldZaps, { ...newZap }].sort((a, b) => b.amount - a.amount).slice(0, 4);
    updateReactionsState('topZapsFeed', () => [...zaps]);
  }

  const removeTopZapFeed = (zapOption: ZapOption) => {
    const zaps = reactionsState.topZapsFeed.filter(z => z.id !== latestTopZapFeed);
    updateReactionsState('topZapsFeed', () => [...zaps]);
  };

  const addTopZap = (zapOption: ZapOption) => {
    const pubkey = accountStore.publicKey;

    if (!pubkey) return;

    const oldZaps = [ ...reactionsState.topZaps ];

    latestTopZap = uuidv4() as string;

    const newZap = {
      amount: zapOption.amount || 0,
      message: zapOption.message || '',
      pubkey,
      eventId: props.poll.id,
      id: latestTopZap,
    };

    if (!threadContext?.users.find((u) => u.pubkey === pubkey)) {
      threadContext?.actions.fetchUsers([pubkey])
    }

    const zaps = [ ...oldZaps, { ...newZap }].sort((a, b) => b.amount - a.amount);
    updateReactionsState('topZaps', () => [...zaps]);
  };

  const removeTopZap = (zapOption: ZapOption) => {
    const zaps = reactionsState.topZaps.filter(z => z.id !== latestTopZap);
    updateReactionsState('topZaps', () => [...zaps]);
  };

  const openReactionModal = (openOn = 'default') =>  {
    app?.actions.openReactionModal(props.poll.id, {
      likes: reactionsState.likes,
      zaps: reactionsState.zapCount,
      reposts: reactionsState.reposts,
      quotes: reactionsState.quoteCount,
      openOn,
    });
  };

  const onContextMenuTrigger = () => {
    app?.actions.openContextMenu(
      props.poll,
      noteContextMenu?.getBoundingClientRect(),
      () => {
        app?.actions.openCustomZapModal(customZapInfo());
      },
      openReactionModal,
      (id: string, isRepost?: boolean) => {
        props.onRemove && props.onRemove(id, isRepost);
      },
    );
  }

  const noteLinkId = () => {
    try {
      return `/e/${props.poll.noteIdShort}`;
    } catch(e) {
      return '/404';
    }
  };

  return (
    <div
      id={props.id}
      class={styles.userPoll}
      data-event={props.poll.msg.id}
      data-event-bech32={props.poll.noteId}
      draggable={false}
    >
      <div
        class={styles.userHeader}
      >
          <div class={styles.content}>
            <div class={styles.leftSide}>
              <a href={app?.actions.profileLink(props.poll.user.npub) || ''}>
                <Avatar user={props.poll.user} size="vs" />
              </a>
            </div>

            <div class={styles.rightSide}>
              <div>
                <NoteAuthorInfo
                  author={props.poll.user}
                  time={props.poll.msg.created_at}
                />
              </div>

              <div class={styles.upRightFloater}>
                <NoteContextTrigger
                  ref={noteContextMenu}
                  onClick={onContextMenuTrigger}
                />
              </div>

              <a
                class={styles.question}
                href={!props.onClick ? noteLinkId() : ''}
              >
                <ParsedPoll
                  note={props.poll}
                  width={Math.min(510, window.innerWidth - 72)}
                  margins={1}
                  footerSize="short"
                />
              </a>

              <div class={styles.choices}>
                <Switch>
                  <Match when={isExpired()}>
                    <For each={props.poll.choices}>
                      {choice => (
                        <button
                          class={styles.choiceResult}
                          onClick={() => doVote(choice)}
                        >
                          <div class={styles.option}>
                            <div
                              class={`${styles.graph} ${['sunrise', 'ice'].includes(settings?.theme || '') ? styles.transparent : ''} ${hasVotedFor(choice.id) ? styles.highlight : ''}`}
                              style={`--percent-width: ${choicePercent(choice.id)}%`}
                            >
                            </div>
                            <div class={styles.label}>
                              <div class={styles.text}>
                                {choice.label}
                              </div>
                              <Show when={winner()[0] === choice.id}>
                                <div class={styles.check}></div>
                              </Show>
                            </div>
                          </div>
                          <div class={styles.number}>
                            {choicePercent(choice.id)}%
                          </div>
                        </button>
                      )}
                    </For>
                  </Match>
                  <Match when={hasVotedFor(props.poll.noteActions.voted_for_option || '')}>
                    <For each={props.poll.choices}>
                      {choice => (
                        <button
                          class={styles.choiceResult}
                          onClick={() => doVote(choice)}
                        >
                          <div class={styles.option}>
                            <div
                              class={`${styles.graph} ${['sunrise', 'ice'].includes(settings?.theme || '') ? styles.transparent : ''} ${hasVotedFor(choice.id) ? styles.highlight : ''}`}
                              style={`--percent-width: ${choicePercent(choice.id)}%`}
                            ></div>
                            <div class={styles.label}>
                              <div class={styles.text}>
                                {choice.label}
                              </div>
                            </div>
                          </div>
                          <div class={styles.number}>
                            {choicePercent(choice.id)}%
                          </div>
                        </button>
                      )}
                    </For>
                  </Match>
                  <Match when={true}>
                    <For each={props.poll.choices}>
                      {choice => (
                        <button
                          class={styles.choice}
                          onClick={() => doVote(choice)}
                        >
                          {choice.label}
                        </button>
                      )}
                    </For>
                  </Match>
                </Switch>
              </div>

              <div class={styles.pollStats}>
                <button
                  class={styles.totalVotes}
                  onClick={showVoteDetails}
                >
                  {humanizeNumber(totalVotes(), false)} votes
                </button>
                <Show when={isExpiring()}>
                  <div>&middot;</div>
                  <div class={styles.endsTime}>
                    <Show
                      when={isExpired()}
                      fallback={<>{dateFuture(props.poll.endsAt).label} left</>}
                    >
                      Final results
                    </Show>
                  </div>
                </Show>
              </div>


              <NoteTopZapsCompact
                note={props.poll}
                action={() => {}}
                topZaps={reactionsState.topZapsFeed}
                topZapLimit={4}
              />

              <NoteFooter
                note={props.poll}
                state={reactionsState}
                updateState={updateReactionsState}
                customZapInfo={customZapInfo()}
                onZapAnim={addTopZapFeed}
                size={'short'}
                onDelete={() => {}}
              />

            </div>
          </div>
      </div>
    </div>
  )
}

export default hookForDev(UserPoll);
