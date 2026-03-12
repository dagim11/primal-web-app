import { useIntl } from '@cookbook/solid-intl';
import { Component } from 'solid-js';

import { account as t, actions as tActions } from '../../translations';

import styles from './MissingNWCModal.module.scss';
import { hookForDev } from '../../lib/devTools';
import AdvancedSearchDialog from '../AdvancedSearch/AdvancedSearchDialog';
import { showGetStarted } from '../../stores/accountStore';

import { appStoreLink, playstoreLink } from '../../constants';

import appstoreImg from '../../assets/images/appstore_download.svg';
import playstoreImg from '../../assets/images/playstore_download.svg';
import primalQr from '../../assets/images/primal_qr.png';
import QrCode from '../QrCode/QrCode';

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
