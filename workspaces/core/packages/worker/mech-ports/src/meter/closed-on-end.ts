import type { GrantedReservation, Reservation } from '@mechane/harness';
import { afterSettling } from '@mechane/utilities';
import { Match } from 'effect';

/** A reservation, and what closes its dispatch once the reservation is refused or its settlement ends. */
type ClosedOnEndInput = { readonly reservation: Reservation; readonly close: () => void };

/** A reservation whose dispatch closes once it is refused, or once its settlement ends however it ends. */
export function closedOnEnd({ reservation, close }: ClosedOnEndInput): Reservation {
  const granted: (grant: GrantedReservation) => Reservation = (grant) => {
    const settle: GrantedReservation['settle'] = async (settlement) =>
      await afterSettling({ promise: grant.settle(settlement), run: close });

    return { ...grant, settle };
  };

  const refused: (refusal: Reservation) => Reservation = (refusal) => {
    close();

    return refusal;
  };

  return Match.valueTags(reservation, { Granted: granted, Refused: refused });
}
