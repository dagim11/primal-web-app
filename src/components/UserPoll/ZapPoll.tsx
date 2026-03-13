import { batch, Component, createSignal, For, Match, onMount, Show, Switch } from "solid-js";
import { hookForDev } from "../../lib/devTools";

import styles from './UserPoll.module.scss';
import { PrimalPollChoice, PrimalUserPoll, ZapOption } from "../../types/primal";
import { CustomZapInfo, useAppContext } from "../../contexts/AppContext";
import Avatar from "../Avatar/Avatar";
import NoteAuthorInfo from "../Note/NoteAuthorInfo";
import ParsedPoll from "../ParsedNote/ParsedPoll";
import { sendUserPollVote } from "../../lib/notes";
import { dateFuture } from "../../lib/dates";
import { now, uuidv4 } from "../../utils";
import { humanizeNumber } from "../../lib/stats";
import NoteTopZapsCompact from "../Note/NoteTopZapsCompact";
import { createStore } from "solid-js/store";
import { NoteReactionsState } from "../Note/Note";
import NoteFooter from "../Note/NoteFooter/NoteFooter";
import { accountStore, hasPublicKey, setShowPin, showGetStarted, showMissingNWC } from "../../stores/accountStore";
import { useThreadContext } from "../../contexts/ThreadContext";
import { useSettingsContext } from "../../contexts/SettingsContext";
import NoteContextTrigger from "../Note/NoteContextTrigger";
import NoteHeader from "../Note/NoteHeader/NoteHeader";
import NoteTopZaps from "../Note/NoteTopZaps";
import NoteRepostHeader from "../Note/NoteRepostHeader";
import { Kind } from "../../constants";
import { readSecFromStorage } from "../../lib/localStore";

export type UserPollProps = {
  id: string,
  poll: PrimalUserPoll
  hideContext?: boolean,
  pollType?: 'feed' | 'primary' | 'embedded',
  onRemove?: (id: string, isRepost?: boolean) => void,
}

const ZapPoll: Component<UserPollProps> = (props) => {

  const app = useAppContext();
  const threadContext = useThreadContext();
  const settings = useSettingsContext();

  const pollType = () => props.pollType || 'feed';

  const [reactionsState, updateReactionsState] = createStore<NoteReactionsState>({
    likes: props.poll.stats?.likes || 0,
    liked: props.poll.noteActions?.liked || false,
    reposts: props.poll.stats?.reposts || 0,
    reposted: props.poll.noteActions?.reposted || false,
    replies: props.poll.stats?.replies || 0,
    replied: props.poll.noteActions?.replied || false,
    zapCount: props.poll.stats?.zaps || 0,
    satsZapped: props.poll.stats?.satszapped || 0,
    zapped: props.poll.noteActions?.zapped || false,
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
  const [votedFor, setVotedFor] = createSignal('');
  const [votedSats, setVotedSats] = createSignal(props.poll.zapLimits?.min || 0);

  const doVote = async (choice: PrimalPollChoice) => {
    if (!hasPublicKey() || ['guest', 'none', 'npub'].includes(accountStore.loginType)) {
      showGetStarted();
      return;
    }

    if (accountStore.activeNWC.length === 0) {
      showMissingNWC();
      return;
    }

    if (!accountStore.sec || accountStore.sec.length === 0) {
      const sec = readSecFromStorage();
      if (sec) {
        setShowPin(sec);
        return;
      }
    }

    app?.actions.openVoteZapModal({
      poll: props.poll,
      choice,
      onConfirm: (zapOption: ZapOption) => {
        app?.actions.closeVoteZapModal();
        setVotedFor(choice.id);
        setDidVote(true);
        setVotedSats(zapOption.amount || 0);
        batch(() => {
          updateReactionsState('zappedAmount', () => zapOption.amount || 0);
          updateReactionsState('satsZapped', (z) => z + (zapOption.amount || 0));
          updateReactionsState('zapped', () => true);
          updateReactionsState('showZapAnim', () => true)
        });
      },
      onSuccess: (zapOption: ZapOption) => {
        setVotedFor(choice.id);
        setDidVote(true);
        setVotedSats(zapOption.amount || 0);
        app?.actions.closeVoteZapModal();
        app?.actions.resetVoteZap();
      },
      onFail: (zapOption: ZapOption) => {
        setVotedFor('');
        setDidVote(false);
        setVotedSats(0);
        app?.actions.closeVoteZapModal();
        app?.actions.resetVoteZap();
      },
      onCancel: (zapOption: ZapOption) => {
        setVotedFor('');
        setDidVote(false);
        setVotedSats(0);
        app?.actions.closeVoteZapModal();
        app?.actions.resetVoteZap();
      },
    })

  }

  const totalVotes = () => {
    const results = props.poll.results
    if (!results) return didVote() ? 1 : 0;
    const choices = Object.keys(results);

    return choices.reduce<number>((acc, id) => {
      return acc + (results[id]?.votes || 0);
    }, 0) + (didVote() ? 1 : 0)
  }

  const totalSats = () => {
    const results = props.poll.results
    if (!results) return didVote() ? 1 : 0;
    const choices = Object.keys(results);

    return choices.reduce<number>((acc, id) => {
      return acc + (results[id]?.satszapped || 0);
    }, 0) + (didVote() ? votedSats() : 0)
  }

  const isExpiring = () => {
    return props.poll.endsAt > (props.poll.msg.created_at || 0)
  }

  const isExpired = () => {
    return props.poll.endsAt < now();
  }

  const choicePercent = (id: string) => {
    const results = props.poll.results?.[id];
    if (!results) return didVote() && votedFor() === id ? 100 : 0;
    const votes = (results.satszapped || 0) + (didVote()&& votedFor() === id ? votedSats() : 0);
    const total = totalSats();

    return ((votes/total)*100).toFixed(1);
  }

  const choiceZaps = (id: string) => {
    const results = props.poll.results?.[id];
    if (!results) return didVote() && votedFor() === id ? votedSats() : 0;
    return (results.satszapped || 0) + (didVote() && votedFor() === id ? votedSats() : 0);
  }

  const winner = () => {
    const results = props.poll.results;

    if (!results) return ['', 0];

    const choices = Object.keys(results);

    return choices.reduce<[string, number]>((acc, id) => {
      const votes = results[id]?.votes || 0;
      return votes >= acc[1] ? [id, votes] : acc;
    }, ['', 0])
  }

  const hasVotedFor = (id: string) => {
    return didVote() ? votedFor() === id : (props.poll.noteActions?.voted_for_option === id);
  }

  const showVoteDetails = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    app?.actions.openVotesModal(props.poll, {
      didVote: didVote(),
      votedFor: votedFor(),
      votedSats: votedSats(),
    });
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
      updateReactionsState('zapped', () => props.poll.noteActions?.zapped);
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
      updateReactionsState('zapped', () => props.poll.noteActions?.zapped);
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
    <Switch>
      <Match when={pollType() === 'primary'}>
        <div
          id={props.id}
          class={styles.userPrimaryPoll}
          data-event={props.poll.msg.id}
          data-event-bech32={props.poll.noteId}
          draggable={false}
        >

          <div class={styles.border}></div>

          <div class={styles.header}>
            <NoteHeader note={props.poll} primary={true} />
          </div>

          <div class={styles.upRightFloater}>
            <NoteContextTrigger
              ref={noteContextMenu}
              onClick={onContextMenuTrigger}
            />
          </div>

          <div class={styles.content}>

            <div class={`${styles.message}`}>
              <ParsedPoll
                note={props.poll}
                width={Math.min(510, window.innerWidth - 72)}
                margins={1}
                footerSize="short"
              />

              <div class={styles.choices}>
                <Switch>
                  <Match when={isExpired()}>
                    <For each={props.poll.choices}>
                      {choice => (
                        <button
                          class={`${styles.choiceResult} ${styles.locked}`}
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
                            <Show
                              when={props.poll?.msg.kind === Kind.ZapPoll}
                              fallback={
                                <div>{choicePercent(choice.id)}%</div>
                              }
                            >
                              <div
                                class={styles.satsZapped}
                                title={`${choiceZaps(choice.id)}`}
                              >
                                {humanizeNumber(choiceZaps(choice.id), true)} <span>sats</span>
                              </div>
                            </Show>
                          </div>
                        </button>
                      )}
                    </For>
                  </Match>
                  <Match when={hasVotedFor(props.poll.noteActions?.voted_for_option || votedFor())}>
                    <For each={props.poll.choices}>
                      {choice => (
                        <button
                          class={`${styles.choiceResult} ${styles.locked}`}
                        >
                          <div class={`${styles.option} ${props.poll?.msg.kind === Kind.ZapPoll ? styles.satsOption : ''}`}>
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
                            <Show
                              when={props.poll?.msg.kind === Kind.ZapPoll}
                              fallback={
                                <div>{choicePercent(choice.id)}%</div>
                              }
                            >
                              <div
                                class={styles.satsZapped}
                                title={`${choiceZaps(choice.id)}`}
                              >
                                {humanizeNumber(choiceZaps(choice.id), true)} <span>sats</span>
                              </div>
                            </Show>
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
                          onClick={(e: MouseEvent) => {
                            e.preventDefault();
                            e.stopPropagation();
                            doVote(choice);
                          }}
                        >
                          {choice.label}
                          <div class={styles.zapIcon}></div>
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
                  disabled={totalVotes() < 1}
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
            </div>

            <div class={styles.topZaps}>
              <NoteTopZaps
                note={props.poll}
                action={() => openReactionModal('zaps')}
                topZaps={reactionsState.topZapsFeed}
                topZapLimit={4}
              />
            </div>

            <div class={styles.footer}>
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
      </Match>


      <Match when={pollType() === 'embedded'}>
        <div
          id={props.id}
          class={styles.userPollEmbedded}
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

                <a
                  class={styles.question}
                  href={noteLinkId()}
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
                            class={`${styles.choiceResult} ${styles.locked}`}
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
                              <Show
                                when={props.poll?.msg.kind === Kind.ZapPoll}
                                fallback={
                                  <div>{choicePercent(choice.id)}%</div>
                                }
                              >
                                <div
                                  class={styles.satsZapped}
                                  title={`${choiceZaps(choice.id)}`}
                                >
                                  {humanizeNumber(choiceZaps(choice.id), true)} <span>sats</span>
                                </div>
                              </Show>
                            </div>
                          </button>
                        )}
                      </For>
                    </Match>
                    <Match when={hasVotedFor(props.poll.noteActions?.voted_for_option || votedFor())}>
                      <For each={props.poll.choices}>
                        {choice => (
                          <button
                            class={`${styles.choiceResult} ${styles.locked}`}
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
                              <Show
                                when={props.poll?.msg.kind === Kind.ZapPoll}
                                fallback={
                                  <div>{choicePercent(choice.id)}%</div>
                                }
                              >
                                <div
                                  class={styles.satsZapped}
                                  title={`${choiceZaps(choice.id)}`}
                                >
                                  {humanizeNumber(choiceZaps(choice.id), true)} <span>sats</span>
                                </div>
                              </Show>
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
                            onClick={(e: MouseEvent) => {
                              e.preventDefault();
                              e.stopPropagation();
                              doVote(choice);
                            }}
                          >
                            {choice.label}
                            <div class={styles.zapIcon}></div>
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
                    disabled={totalVotes() < 1}
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

              </div>
            </div>
          </div>
        </div>
      </Match>

      <Match when={true}>
        <div
          id={props.id}
          class={styles.userPoll}
          data-event={props.poll.msg.id}
          data-event-bech32={props.poll.noteId}
          draggable={false}
        >
          <div class={styles.header}>
            <Show when={props.poll.repost}>
              <NoteRepostHeader note={props.poll} />
            </Show>
          </div>
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
                  href={noteLinkId()}
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
                            class={`${styles.choiceResult} ${styles.locked}`}
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
                              <Show
                                when={props.poll?.msg.kind === Kind.ZapPoll}
                                fallback={
                                  <div>{choicePercent(choice.id)}%</div>
                                }
                              >
                                <div
                                  class={styles.satsZapped}
                                  title={`${choiceZaps(choice.id)}`}
                                >
                                  {humanizeNumber(choiceZaps(choice.id), true)} <span>sats</span>
                                </div>
                              </Show>
                            </div>
                          </button>
                        )}
                      </For>
                    </Match>
                    <Match when={hasVotedFor(props.poll.noteActions?.voted_for_option || votedFor())}>
                      <For each={props.poll.choices}>
                        {choice => (
                          <button
                            class={`${styles.choiceResult} ${styles.locked}`}
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
                              <Show
                                when={props.poll?.msg.kind === Kind.ZapPoll}
                                fallback={
                                  <div>{choicePercent(choice.id)}%</div>
                                }
                              >
                                <div
                                  class={styles.satsZapped}
                                  title={`${choiceZaps(choice.id)}`}
                                >
                                  {humanizeNumber(choiceZaps(choice.id), true)} <span>sats</span>
                                </div>
                              </Show>
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
                            onClick={(e: MouseEvent) => {
                              e.preventDefault();
                              e.stopPropagation();
                              doVote(choice);
                            }}
                          >
                            {choice.label}
                            <div class={styles.zapIcon}></div>
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
                    disabled={totalVotes() < 1}
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
      </Match>
    </Switch>
  )
}

export default hookForDev(ZapPoll);
