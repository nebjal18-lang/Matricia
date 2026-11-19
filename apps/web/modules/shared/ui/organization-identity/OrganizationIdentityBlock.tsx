import {
  getOrganizationIdentityMessages,
  type OrganizationIdentityMessages,
} from "@/modules/shared/ui/organization-identity/messages";
import {
  displayIdentityValue,
  formatIdentityAddress,
  type OrganizationIdentityView,
} from "@/modules/shared/ui/organization-identity/model";
import type { Locale } from "@/modules/shared/lib/i18n/locale";

type Props = {
  locale: Locale;
  identity: OrganizationIdentityView;
  messages?: OrganizationIdentityMessages;
  showRepresentative?: boolean;
  showIdentifiers?: boolean;
  className?: string;
  idPrefix?: string;
};

function DlRow({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd dir={ltr ? "ltr" : undefined}>{value}</dd>
    </div>
  );
}

export function OrganizationIdentityBlock({
  locale,
  identity,
  messages: messagesProp,
  showRepresentative = true,
  showIdentifiers = true,
  className,
  idPrefix = "org-identity",
}: Props) {
  const id = idPrefix;
  const messages = messagesProp ?? getOrganizationIdentityMessages(locale);
  const empty = messages.empty;
  const address = identity.registeredAddress ?? {};
  const rep = identity.representative ?? {};
  const identifiers = identity.identifiers ?? {};

  return (
    <div className={`mat-identity-block mat-identity-grid ${className ?? ""}`.trim()}>
      <article className="client-card" data-tone="violet">
        <header>
          <h2 id={`${id}-identity`}>{messages.identity}</h2>
        </header>
        <dl className="admin-dl" aria-labelledby={`${id}-identity`}>
          <DlRow
            label={messages.legalName}
            value={displayIdentityValue(identity.legalName, empty)}
          />
          <DlRow
            label={messages.displayName}
            value={displayIdentityValue(identity.displayName, empty)}
          />
          <DlRow
            label={messages.country}
            value={displayIdentityValue(identity.countryCode, empty)}
            ltr
          />
          <DlRow
            label={messages.legalForm}
            value={displayIdentityValue(identity.legalForm, empty)}
          />
          <DlRow
            label={messages.incorporationDate}
            value={displayIdentityValue(identity.incorporationDate, empty)}
            ltr
          />
          <DlRow
            label={messages.activity}
            value={displayIdentityValue(identity.activity, empty)}
          />
          <DlRow label={messages.sector} value={displayIdentityValue(identity.sector, empty)} />
          <DlRow
            label={messages.city}
            value={displayIdentityValue(identity.registeredCity ?? address.city, empty)}
          />
          <DlRow label={messages.address} value={formatIdentityAddress(address, empty)} />
          <DlRow
            label={messages.postalCode}
            value={displayIdentityValue(address.postal_code, empty)}
            ltr
          />
        </dl>
      </article>

      {showIdentifiers ? (
        <article className="client-card" data-tone="mint">
          <header>
            <h2 id={`${id}-ids`}>{messages.identifiers}</h2>
          </header>
          <dl className="admin-dl" aria-labelledby={`${id}-ids`}>
            {(["ICE", "IF", "RC"] as const).map((key) => (
              <DlRow
                key={key}
                label={messages.identifierLabels[key]}
                value={displayIdentityValue(identifiers[key], empty)}
                ltr
              />
            ))}
          </dl>
        </article>
      ) : null}

      {showRepresentative ? (
        <article className="client-card" data-tone="coral">
          <header>
            <h2 id={`${id}-rep`}>{messages.representative}</h2>
          </header>
          <dl className="admin-dl" aria-labelledby={`${id}-rep`}>
            <DlRow
              label={messages.firstName}
              value={displayIdentityValue(rep.first_name, empty)}
            />
            <DlRow label={messages.lastName} value={displayIdentityValue(rep.last_name, empty)} />
            <DlRow label={messages.titleRole} value={displayIdentityValue(rep.title, empty)} />
            <DlRow label={messages.email} value={displayIdentityValue(rep.email, empty)} ltr />
            <DlRow label={messages.phone} value={displayIdentityValue(rep.phone, empty)} ltr />
            <DlRow label={messages.power} value={displayIdentityValue(rep.power, empty)} />
          </dl>
        </article>
      ) : null}
    </div>
  );
}
