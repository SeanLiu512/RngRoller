import { useState } from 'react';
import { db } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';

export default function TwoFactorSettings({ user, onUpdated }) {
  const [step, setStep] = useState('idle'); // idle | setup | disabling
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const enabled = !!user?.twoFactorEnabled;

  const startSetup = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await db.auth.setup2FA();
      setQrCodeDataUrl(result.qrCodeDataUrl);
      setSecret(result.secret);
      setStep('setup');
    } catch (err) {
      setError(err.message || 'Failed to start setup');
    } finally {
      setLoading(false);
    }
  };

  const confirmSetup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const updated = await db.auth.verify2FASetup(code);
      setStep('idle');
      setCode('');
      onUpdated?.(updated);
    } catch (err) {
      setError(err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const confirmDisable = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const updated = await db.auth.disable2FA(password);
      setStep('idle');
      setPassword('');
      onUpdated?.(updated);
    } catch (err) {
      setError(err.message || 'Incorrect password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-3 flex items-center gap-2">
        {enabled ? (
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
        ) : (
          <ShieldOff className="h-5 w-5 text-zinc-500" />
        )}
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Two-Factor Authentication
        </h2>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {step === 'idle' && (
        <>
          <p className="mb-4 text-sm text-zinc-500">
            {enabled
              ? 'Enabled — your account requires a code from your authenticator app to log in.'
              : 'Add an authenticator app (Google Authenticator, Authy, etc.) as a second step when logging in.'}
          </p>
          {enabled ? (
            <Button variant="outline" onClick={() => setStep('disabling')}>
              Disable 2FA
            </Button>
          ) : (
            <Button onClick={startSetup} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enable 2FA'}
            </Button>
          )}
        </>
      )}

      {step === 'setup' && (
        <form onSubmit={confirmSetup} className="space-y-4">
          <p className="text-sm text-zinc-500">
            Scan this with your authenticator app, then enter the 6-digit code it shows.
          </p>
          {qrCodeDataUrl && (
            <img src={qrCodeDataUrl} alt="2FA QR code" className="mx-auto rounded-lg bg-white p-2" width={200} height={200} />
          )}
          <p className="break-all text-center text-xs text-zinc-600">
            Can't scan it? Enter this key manually: <span className="font-mono">{secret}</span>
          </p>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading || code.length < 6}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm & Enable'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setStep('idle'); setCode(''); setError(''); }}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {step === 'disabling' && (
        <form onSubmit={confirmDisable} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="disable2fa-password">Confirm your password to disable 2FA</Label>
            <Input
              id="disable2fa-password"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="destructive" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disable 2FA'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setStep('idle'); setPassword(''); setError(''); }}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
