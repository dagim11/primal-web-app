import { useIntl } from '@cookbook/solid-intl';
import { Tabs } from '@kobalte/core/tabs';
import { A, useNavigate } from '@solidjs/router';
import { Component, createEffect, createSignal, For, Match, on, Show, Switch } from 'solid-js';
import { createStore } from 'solid-js/store';
import { APP_ID } from '../../App';
import { Kind, urlRegexG } from '../../constants';
import { ReactionStats, useAppContext } from '../../contexts/AppContext';
import { hookForDev } from '../../lib/devTools';
import { hexToNpub } from '../../lib/keys';
import {
  getEventQuotes,
  getEventQuoteStats,
  getEventReactions,
  getEventZaps,
  getPollVotes,
  parseLinkPreviews,
  PollVote,
} from '../../lib/notes';
import { truncateNumber2 } from '../../lib/notifications';
import { subsTo } from '../../sockets';
import { convertToNotes } from '../../stores/note';
import { userName } from '../../stores/profile';
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
  PrimalNote,
  PrimalUserPoll,
} from '../../types/primal';
import { parseBolt11 } from '../../utils';
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


const VotesModal: Component<{
  id?: string,
  poll: PrimalUserPoll | undefined,
  onClose?: () => void,
}> = (props) => {

  const intl = useIntl();
  const app = useAppContext();
  const navigate = useNavigate();

  const [isFetching, setIsFetching] = createSignal(false);

  const [votes, setVotes] = createStore<PollVote[]>([]);

  const [selectedChoice, setSelectedChoice] = createSignal('');

  const fetchVotes = async (id: string) => {
    const poll = props.poll;
    if (!poll || !poll.choices || poll.choices.length < 1) return;
    const { pollVotes } = await getPollVotes(id, poll.choices[0].id || '', {
      limit: 20,
    });

    setVotes(pollVotes);
  }

  createEffect(on(() => props.poll, (poll, prev) => {
    if (!poll || poll.id === prev?.id) return;

    fetchVotes(poll.id);
  }));

  const choices = () => {
    return props.poll?.choices.map((c, i) => ({
      label: c.label,
      value: c.id,
      deafault: i === 0,
    }))
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
      <div id={props.id} class={styles.ReactionsModal}>
        <Switch>
          <Match when={!isFetching}>
            {intl.formatMessage(tPlaceholders.noReactionDetails)}
          </Match>
        </Switch>

        <div class={styles.description}>
          <div class={styles.choiceSelection}>
            <SelectBox
              options={choices}
              onChange={(option: FeedOption) => setSelectedChoice(option.value || '')}
              initialValue={choices()?.[0].value}
              isSelected={(option: FeedOption) => selectedChoice() === option.value}
            />
          </div>
          <For each={votes}>
            {vote => (
              <div>{vote.response} {userName(vote.user)}</div>
            )}
          </For>
        </div>
      </div>
    </AdvancedSearchDialog>
  );
}

export default hookForDev(VotesModal);
