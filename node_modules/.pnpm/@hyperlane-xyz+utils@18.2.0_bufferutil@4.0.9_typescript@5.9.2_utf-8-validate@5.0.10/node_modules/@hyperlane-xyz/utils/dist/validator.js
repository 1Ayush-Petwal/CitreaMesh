import { ethers } from 'ethers';
import { eqAddress } from './addresses.js';
import { domainHash } from './domains.js';
import { fromHexString, toHexString } from './strings.js';
/**
 * Utilities for validators to construct and verify checkpoints.
 */
export class BaseValidator {
    config;
    constructor(config) {
        this.config = config;
    }
    get address() {
        return this.config.address;
    }
    announceDomainHash() {
        return domainHash(this.config.localDomain, this.config.mailbox);
    }
    static checkpointDomainHash(localDomain, merkle_tree_address) {
        return domainHash(localDomain, merkle_tree_address);
    }
    static message(checkpoint, messageId) {
        const types = ['bytes32', 'bytes32', 'uint32', 'bytes32'];
        const values = [
            this.checkpointDomainHash(checkpoint.mailbox_domain, checkpoint.merkle_tree_hook_address),
            checkpoint.root,
            checkpoint.index,
            messageId,
        ];
        return ethers.utils.solidityPack(types, values);
    }
    static messageHash(checkpoint, messageId) {
        const message = this.message(checkpoint, messageId);
        return ethers.utils.arrayify(ethers.utils.keccak256(message));
    }
    static recoverAddressFromCheckpoint(checkpoint, signature, messageId) {
        const msgHash = this.messageHash(checkpoint, messageId);
        return ethers.utils.verifyMessage(msgHash, signature);
    }
    static recoverAddressFromCheckpointWithId({ checkpoint, message_id }, signature) {
        return BaseValidator.recoverAddressFromCheckpoint(checkpoint, signature, message_id);
    }
    static recoverAddress({ value, signature }) {
        return BaseValidator.recoverAddressFromCheckpointWithId(value, signature);
    }
    matchesSigner(checkpoint, signature, messageId) {
        const address = BaseValidator.recoverAddressFromCheckpoint(checkpoint, signature, messageId);
        return eqAddress(address, this.config.address);
    }
    getLatestCheckpointIndex() {
        throw new Error('Not implemented');
    }
    storageLocation() {
        throw new Error('Not implemented');
    }
    getLatestCheckpointUrl() {
        throw new Error('Not implemented');
    }
}
/**
 * Create signature for validator announce
 */
export const createAnnounce = async (validatorPrivKey, storageLocation, mailboxId, localDomain) => {
    const domainIdBytes = Buffer.alloc(4);
    domainIdBytes.writeUInt32BE(localDomain);
    const domainHashBytes = toHexString(Buffer.concat([
        domainIdBytes,
        fromHexString(mailboxId),
        Buffer.from('HYPERLANE_ANNOUNCEMENT'),
    ]));
    const domainHash = ethers.utils.keccak256(domainHashBytes);
    const announcementDigestBytes = toHexString(Buffer.concat([fromHexString(domainHash), Buffer.from(storageLocation)]));
    const announcementDigest = ethers.utils.keccak256(announcementDigestBytes);
    return new ethers.Wallet(validatorPrivKey).signMessage(fromHexString(announcementDigest));
};
//# sourceMappingURL=validator.js.map