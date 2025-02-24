export const verifyEmail = (data: {
    name: string;
    email: string;
    link: string;
}) => {
    return `<div style="font-family: Helvetica, Arial, sans-serif; min-width: 1000px; overflow: auto; line-height: 2">
    <div style="margin: 50px auto; width: 70%; padding: 20px 0">
        <div style="border-bottom: 1px solid #eee">
            <a href="" style="font-size: 1.4em; color: #00466a; text-decoration: none; font-weight: 600">Fusion App</a>
        </div>
        <p style="font-size: 1.1em">Hi, ${data?.name ?? "user"},</p>
        <p>We’re excited to have you join Fusion App! You’re just one step away from creating your account.</p>
        <p>Click the button below to confirm your email address and activate your Fusion App account:</p>
        <p><strong>Email:</strong> ${data?.email}</p>
        <a href="${data?.link}" style="background: #00466a; margin: 0 auto; width: max-content; padding: 10px 15px; color: #fff; border-radius: 4px; text-decoration: none; font-size: 1em;">Activate Account</a>
        <p>Once you click the link, your account will be created with the credentials you provided during registration.</p>
        <p>If you did not sign up for a Fusion App account, please ignore this email.</p>
        <p style="font-size: 0.9em;">Best regards,<br />Fusion App Team</p>
        <hr style="border: none; border-top: 1px solid #eee" />
        <div style="float: right; padding: 8px 0; color: #aaa; font-size: 0.8em; line-height: 1; font-weight: 300">
            <p>FUSION</p>
            <p>Germany</p>
            <p>Germany</p>
        </div>
    </div>
  </div>`;
};
