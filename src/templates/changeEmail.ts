export const changeEmailAddress = (data: {
  name: string;
  oldEmail: string;
  newEmail: string;
  link: string;
}) => {
  return `<div style="font-family: Helvetica,Arial,sans-serif;min-width:1000px;overflow:auto;line-height:2">
  <div style="margin:50px auto;width:70%;padding:20px 0">
      <div style="border-bottom:1px solid #eee">
          <a href="" style="font-size:1.4em;color: #00466a;text-decoration:none;font-weight:600">ShwCase App</a>
      </div>
      <p style="font-size:1.1em">Hi, ${data?.name ?? "user"},</p>
      <p>We received a request to change your email address for your ShwCase App account.</p>
      <p><strong>Old Email:</strong> ${data?.oldEmail}</p>
      <p><strong>New Email:</strong> ${data?.newEmail}</p>
      <p>Please click the button below to confirm your email address change:</p>
      <a href="${
        data?.link
      }" style="background: #00466a;margin: 0 auto;width: max-content;padding: 10px 15px;color: #fff;border-radius: 4px;text-decoration: none;font-size: 1em;">Confirm Email Change</a>
      <p>If you did not request this change, please ignore this email or contact support if you have concerns.</p>
      <p style="font-size:0.9em;">Regards,<br />Fitness App</p>
      <hr style="border:none;border-top:1px solid #eee" />
      <div style="float:right;padding:8px 0;color:#aaa;font-size:0.8em;line-height:1;font-weight:300">
          <p>OMOC</p>
          <p>Germany</p>
          <p>Germany</p>
      </div>
  </div>
</div>`;
};
