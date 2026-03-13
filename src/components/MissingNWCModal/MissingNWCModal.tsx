import { useIntl } from '@cookbook/solid-intl';
import { Component } from 'solid-js';

import styles from './MissingNWCModal.module.scss';
import { hookForDev } from '../../lib/devTools';
import AdvancedSearchDialog from '../AdvancedSearch/AdvancedSearchDialog';

const MissingNWCModal: Component<{
  id?: string,
  open?: boolean,
  onClose?: () => void,
}> = (props) => {

  const intl = useIntl();

  return (
    <AdvancedSearchDialog
      open={props.open}
      setOpen={(isOpen: boolean) => !isOpen && props.onClose?.()}
      title={
      <div class={styles.title}>
        Missing Wallet
      </div>
      }
      triggerClass={styles.hidden}
    >
      <div id={props.id} class={styles.modal}>
        No wallet connected. You can configure it on the <a onClick={() => props.onClose?.()} href="/settings/nwc">Connected Wallets settings page</a>
      </div>

    </AdvancedSearchDialog>
  );
}

export default hookForDev(MissingNWCModal);
