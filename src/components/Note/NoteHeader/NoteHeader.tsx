import { Component, createEffect, createSignal, Show } from 'solid-js';
import { PrimalNote, PrimalUserPoll } from '../../../types/primal';

import styles from './NoteHeader.module.scss';
import { nip05Verification, truncateNpub } from '../../../stores/profile';
import VerificationCheck from '../../VerificationCheck/VerificationCheck';
import Avatar from '../../Avatar/Avatar';
import { A } from '@solidjs/router';
import { hexToNpub } from '../../../lib/keys';
import { hookForDev } from '../../../lib/devTools';
import { useAppContext } from '../../../contexts/AppContext';

const NoteHeader: Component<{
  note: PrimalNote | PrimalUserPoll,
  openCustomZap?: () => void,
  id?: string,
  primary?: boolean,
}> = (props) => {

  const app = useAppContext();

  const [showContext, setContext] = createSignal(false);

  const authorName = () => {
    if (!props.note?.user) {
      return hexToNpub(props.note?.msg.pubkey);
    }
    return props.note?.user?.displayName ||
      props.note?.user?.name ||
      truncateNpub(props.note?.user.npub);
  };

  const onClickOutside = (e: MouseEvent) => {
    if (
      !document?.getElementById(`note_context_${props.note?.msg.id}`)?.contains(e.target as Node)
    ) {
      setContext(false);
    }
  }

  createEffect(() => {
    if (showContext()) {
      document.addEventListener('click', onClickOutside);
    }
    else {
      document.removeEventListener('click', onClickOutside);
    }
  });

  const isVerifiedByPrimal = () => {
    return !!props.note?.user.nip05 &&
      props.note?.user.nip05.endsWith('primal.net');
  }

  return (
    <div id={props.id} class={styles.header}>
      <div class={styles.headerInfo}>
        <div
            class={styles.avatar}
            title={props.note?.user?.npub}
          >
            <A
              href={app?.actions.profileLink(props.note?.user.npub) || ''}
            >
              <Avatar
                user={props.note?.user}
                size="vs"
                highlightBorder={isVerifiedByPrimal()}
              />
            </A>
          </div>
        <div class={styles.postInfo}>
          <div class={styles.userInfo}>

            <span class={`${styles.userName} ${props.primary ? styles.primary : ''}`}>
              {authorName()}
            </span>

            <VerificationCheck
              user={props.note?.user}
            />
          </div>
          <Show
            when={props.note?.user?.nip05}
          >
            <span
              class={styles.verification}
              title={props.note?.user?.nip05}
            >
              {nip05Verification(props.note?.user)}
            </span>
          </Show>
        </div>

      </div>
    </div>
  )
}

export default hookForDev(NoteHeader);
