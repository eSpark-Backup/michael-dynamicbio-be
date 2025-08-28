export const registerNewDevice = (data: {
    name: string;
    email: string;
    link: string;
  }) => {
    return `<div style="font-family: Helvetica, Arial, sans-serif; min-width: 1000px; overflow: auto; line-height: 2">
      <div style="margin: 50px auto; width: 70%; padding: 20px 0">
        <div style="border-bottom: 1px solid #eee">
          <a href="" style="font-size: 1.4em; color: #00466a; text-decoration: none; font-weight: 600">Fusion App</a>
        </div>
        <p style="font-size: 1.1em">Hi ${data?.name ?? "user"},</p>
        <p>A new device has been registered for Two-Factor Authentication (2FA) on your Fusion App account:</p>
        <p><strong>Email:</strong> ${data?.email}</p>
        <p>To complete the registration of your new device, please click the button below to receive your QR code for 2FA setup:</p>
        <a href="${data?.link}" style="background: #00466a; margin: 0 auto; width: max-content; padding: 10px 15px; color: #fff; border-radius: 4px; text-decoration: none; font-size: 1em;">
          Get QR Code
        </a>
        <p>If you did not authorize this action, please secure your account immediately using the link above.</p>
        <p>If you need assistance, feel free to contact our support team.</p>
        <p style="font-size: 0.9em;">Regards,<br />Fusion App Team</p>
        <hr style="border: none; border-top: 1px solid #eee" />
        <div style="float: right; padding: 8px 0; color: #aaa; font-size: 0.8em; line-height: 1; font-weight: 300">
          <p>OMOC</p>
          <p>Germany</p>
        </div>
      </div>
    </div>`;
  };
  