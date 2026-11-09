// Mail client autoconfig (Thunderbird format, also read by other clients) for the Purelymail inboxes of tierbase.io.
// Purelymail's own file sits behind a certificate for purelymail.com only, so clients reject it on autoconfig.tierbase.io:
// the site serves the same settings itself.
const XML = `<?xml version="1.0"?>
<clientConfig version="1.1">
  <emailProvider id="purelymail.com">
    <domain>tierbase.io</domain>
    <displayName>Purelymail</displayName>
    <displayShortName>Purelymail</displayShortName>
    <incomingServer type="imap">
      <hostname>imap.purelymail.com</hostname>
      <port>993</port>
      <socketType>SSL</socketType>
      <username>%EMAILADDRESS%</username>
      <authentication>password-cleartext</authentication>
    </incomingServer>
    <outgoingServer type="smtp">
      <hostname>smtp.purelymail.com</hostname>
      <port>465</port>
      <socketType>SSL</socketType>
      <username>%EMAILADDRESS%</username>
      <authentication>password-cleartext</authentication>
    </outgoingServer>
  </emailProvider>
  <webMail>
    <loginPage url="https://inbox.purelymail.com" />
  </webMail>
</clientConfig>
`;

export function mailAutoconfigResponse(): Response {
  return new Response(XML, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=86400" },
  });
}
