<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your CABS verification code</title>
</head>
<body style="margin:0; padding:0; background:#F2F3F4; font-family: Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F3F4; padding: 32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius: 12px; overflow: hidden; max-width: 480px; width: 100%;">
                    <tr>
                        <td style="background:#C0392B; padding: 24px 32px; text-align:center;">
                            <p style="margin:0; color:#ffffff; font-size:20px; font-weight:bold; letter-spacing: 2px;">CABS</p>
                            <p style="margin:4px 0 0; color:rgba(255,255,255,0.75); font-size:12px;">Cabuyao Athletes Basic School</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 32px;">
                            <p style="margin:0 0 4px; font-size:16px; color:#1C2833;">Hi {{ $name }},</p>
                            <p style="margin:0 0 20px; font-size:14px; color:#1C2833; line-height:1.6;">
                                Thanks for creating a CABS account. Enter the code below to verify your email address
                                and finish setting up your account.
                            </p>
                            <div style="background:#FADBD8; border: 1px solid #f3c6c1; border-radius: 8px; padding: 18px; text-align:center; margin-bottom: 20px;">
                                <p style="margin:0; font-size:32px; font-weight:bold; letter-spacing: 10px; color:#C0392B;">{{ $code }}</p>
                            </div>
                            <p style="margin:0 0 8px; font-size:13px; color:#717D7E;">
                                This code expires at <strong>{{ $expiresAt?->format('g:i A') }}</strong>
                                ({{ $expiresAt?->diffForHumans() }}).
                            </p>
                            <p style="margin:0; font-size:13px; color:#717D7E;">
                                If you didn't create a CABS account, you can safely ignore this email.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 16px 32px 28px; border-top: 1px solid #E5E7E9;">
                            <p style="margin:0; font-size:11px; color:#999; text-align:center;">
                                &copy; {{ date('Y') }} Cabuyao Athletes Basic School &middot; CABS Online Reservation, Booking &amp; Payment System
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
