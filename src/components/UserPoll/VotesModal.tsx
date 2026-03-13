import { useIntl } from '@cookbook/solid-intl';
import { Tabs } from '@kobalte/core/tabs';
import { A, useNavigate } from '@solidjs/router';
import { Component, createEffect, createSignal, For, Match, on, Show, Switch } from 'solid-js';
import { createStore } from 'solid-js/store';
import { APP_ID } from '../../App';
import { Kind, urlRegexG } from '../../constants';
import { PollVoteModalConfig, ReactionStats, useAppContext } from '../../contexts/AppContext';
import { hookForDev } from '../../lib/devTools';
import { hexToNpub } from '../../lib/keys';
import {
  getEventQuotes,
  getEventQuoteStats,
  getEventReactions,
  getEventZaps,
  getPollVotes,
  getZapPollVotes,
  parseLinkPreviews,
  PollVote,
} from '../../lib/notes';
import { truncateNumber2 } from '../../lib/notifications';
import { subsTo } from '../../sockets';
import { convertToNotes } from '../../stores/note';
import { nip05Verification, userName } from '../../stores/profile';
import { actions as tActions, placeholders as tPlaceholders, reactionsModal } from '../../translations';
import {
  FeedOption,
  FeedPage,
  NostrMentionContent,
  NostrNoteActionsContent,
  NostrNoteContent,
  NostrStatsContent,
  NostrUserContent,
  NoteActions,
  PollResults,
  PrimalNote,
  PrimalUserPoll,
} from '../../types/primal';
import { now, parseBolt11 } from '../../utils';
import AdvancedSearchDialog from '../AdvancedSearch/AdvancedSearchDialog';
import Avatar from '../Avatar/Avatar';
import Loader from '../Loader/Loader';
import Note from '../Note/Note';
import Paginator from '../Paginator/Paginator';
import VerificationCheck from '../VerificationCheck/VerificationCheck';

import styles from './UserPoll.module.scss';
import DOMPurify from 'dompurify';
import { accountStore } from '../../stores/accountStore';
import SelectBox from '../SelectBox/SelectBox';
import { useSettingsContext } from '../../contexts/SettingsContext';
import { humanizeNumber } from '../../lib/stats';
import { dateFuture } from '../../lib/dates';


const VotesModal: Component<{
  id?: string,
  poll: PrimalUserPoll | undefined,
  config: PollVoteModalConfig | undefined,
  onClose?: () => void,
}> = (props) => {

  const intl = useIntl();
  const app = useAppContext();
  const navigate = useNavigate();
  const settings = useSettingsContext();

  const [isFetching, setIsFetching] = createSignal(false);

  const [votes, setVotes] = createStore<PollVote[]>([]);

  const [selectedChoice, setSelectedChoice] = createSignal('');

  const fetchVotes = async (id: string, option: string) => {
    const poll = props.poll;
    if (!poll || !poll.choices || poll.choices.length < 1) return;

    if (props.poll?.msg.kind === Kind.UserPoll) {
      const { pollVotes } = await getPollVotes(id, option, `poll_votes_${id}_${APP_ID}`, {
        limit: 20,
      });

      setVotes(pollVotes);
      return;
    }

    if (props.poll?.msg.kind === Kind.ZapPoll) {
      const pollVotes = await getZapPollVotes(id, option, `poll_zap_votes_${id}_${APP_ID}`, {
        limit: 20,
      });

      setVotes(pollVotes);
      return;
    }

    // setVotes(vs);
  }

  const fetchVotesNextPage = async (id: string, option: string) => {
    const poll = props.poll;
    if (!poll || !poll.choices || poll.choices.length < 1) return;

    if (votes.length === 0) return;


    if (props.poll?.msg.kind === Kind.UserPoll) {
      const { pollVotes } = await getPollVotes(id, option, `poll_votes_np_${id}_${APP_ID}`, {
        limit: 20,
        offset: votes.length,
      });
      setVotes(v => [ ...v, ...pollVotes]);
      return;
    }
    if (props.poll?.msg.kind === Kind.ZapPoll) {
      const pollVotes = await getZapPollVotes(id, option, `poll_zap_votes_np_${id}_${APP_ID}`, {
        limit: 20,
        offset: votes.length,
      });
      setVotes(v => [ ...v, ...pollVotes]);
      return;
    }
  }


  createEffect(on(() => props.poll, (poll, prev) => {
    if (!poll || poll.id === prev?.id) {
      setVotes([]);
      setSelectedChoice('');
      return;
    }

    const choice = poll.choices.find(c => {
      let votes = 0;
      let results = poll.results?.[c.id];
      if (results) {
        votes = results.votes || 0;
      }
      else if (c.id === props.config?.votedFor) {
        votes = props.config?.didVote ? 1 : 0;
      }
      return votes > 0;
    });

    setSelectedChoice(choice?.id || '');
  }));

  createEffect(on(selectedChoice, (id, prev) => {
    if (!id || id === prev || !props.poll) return;

    fetchVotes(props.poll.id, id);
  }));

  const pollResults = () => {
    const poll = props.poll;
    if (!poll) return undefined;

    let results = poll.results
    if (!results) {
      results = poll.choices.reduce<PollResults>((acc, choice) => {
        return ({
        ...acc,
        [choice.id]: {
          votes: props.config?.didVote && props.config?.votedFor === choice.id ? 1 : 0,
          satszapped: props.config?.didVote && props.config?.votedFor === choice.id ? (props.config?.votedSats || 0) : 0,
        }
      })}, {})
    }

    return results;
  }

  const totalVotes = () => {
    const results = pollResults();
    if (!results) return 0;

    const choices = Object.keys(results);

    return choices.reduce<number>((acc, id) => {
      return acc + (results[id]?.votes || 0);
    }, 0);
  }

  const choicePercent = (id: string) => {
    const results = pollResults();

    const votes = results?.[id]?.votes || 0;
    const total = totalVotes();

    return ((votes/total)*100).toFixed(1);
  }

  const choiceZaps = (id: string) => {
    const results = pollResults();

    return results?.[id]?.satszapped || 0;
  }

  const isExpiring = () => {
    return (props.poll?.endsAt || 0) > (props.poll?.msg?.created_at || 0)
  }

  const isExpired = () => {
    return (props.poll?.endsAt || 0) < now();
  }

  return (
    <AdvancedSearchDialog
      open={props.poll !== undefined}
      setOpen={(isOpen: boolean) => !isOpen && props.onClose && props.onClose()}
      title={
        <div class={styles.title}>
          <div class={styles.caption}>
            Votes
          </div>
        </div>
      }
      triggerClass={styles.hidden}
    >
      <div id={props.id} class={styles.voteModal}>
        <div class={styles.voteChoices}>
          <For each={props.poll?.choices}>
            {choice => (
              <button
                class={`${styles.voteChoice} ${selectedChoice() === choice.id ? styles.highlight : ''}`}
                onClick={() => setSelectedChoice(choice.id)}
                disabled={(pollResults()?.[choice.id]?.votes || 0) < 1}
              >
                <div class={`${styles.option} ${props.poll?.msg.kind === Kind.ZapPoll ? styles.satsOption : ''}`}>
                  <div
                    class={`${styles.graph} ${['sunrise', 'ice'].includes(settings?.theme || '') ? styles.transparent : ''} ${selectedChoice() === choice.id ? styles.highlight : ''}`}
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
                      title={choiceZaps(choice.id)}
                    >
                      {humanizeNumber(choiceZaps(choice.id), true)} <span>sats</span>
                    </div>
                  </Show>
                  <div class={styles.moreVotes}>see votes</div>
                </div>
              </button>
            )}
          </For>
        </div>

        <div class={styles.voteStats}>
          <div
            class={styles.totalVotes}
          >
            {humanizeNumber(totalVotes(), false)} votes
          </div>
          <Show when={isExpiring()}>
            <div>&middot;</div>
            <div class={styles.endsTime}>
              <Show
                when={isExpired()}
                fallback={<>{dateFuture(props.poll?.endsAt || 0).label} left</>}
              >
                Final results
              </Show>
            </div>
          </Show>
        </div>

        <div class={styles.voteListDevider}>
          <div class={styles.selectedChoice}>
            {(props.poll?.choices || []).find(c => c.id === selectedChoice())?.label}
          </div>
          <div class={styles.selectedVotes}>
            {humanizeNumber(pollResults()?.[selectedChoice()]?.votes || 0)} votes
          </div>
        </div>

        <div class={styles.voteList}>
          <For each={votes}>
            {vote => (
              <div class={styles.voteDetails}>
                <Show when={vote.amount}>
                  <div class={styles.zappedAmount}>
                    <div class={styles.zapIcon}></div>
                    <div class={styles.amount}>
                      {humanizeNumber(vote.amount || 0)}
                    </div>
                  </div>
                </Show>
                <a
                  href={app?.actions.profileLink(vote.user.npub) || ''}
                  onClick={() => props.onClose?.()}
                >
                  <Avatar user={vote.user} size="vvs"></Avatar>
                </a>

                <div class={styles.postInfo}>
                  <div class={styles.userInfo}>
                    <span class={styles.userName}>
                      {userName(vote.user)}
                    </span>

                    <VerificationCheck
                      user={vote.user}
                    />
                  </div>
                  <Switch>
                    <Match when={vote.message && vote.message.length > 0}>
                      <span
                        class={styles.verification}
                      >
                        {vote.message}
                      </span>
                    </Match>
                    <Match when={vote.user?.nip05}>
                      <span
                        class={styles.verification}
                      >
                        {nip05Verification(vote.user)}
                      </span>
                    </Match>
                  </Switch>
                </div>
              </div>
            )}
          </For>
          <Paginator
            loadNextPage={() => fetchVotesNextPage(props.poll?.id || '', selectedChoice())}
            isSmall={true}
          />
        </div>
      </div>
    </AdvancedSearchDialog>
  );
}

export default hookForDev(VotesModal);
