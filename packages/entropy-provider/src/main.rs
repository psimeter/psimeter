//! PsiMeter entropy-provider — a deliberately tiny sidecar whose ONLY job is to
//! emit RAW, UNCONDITIONED random bytes from a hardware source, so the rest of
//! the platform (TypeScript) never contains CPU/hardware-specific code. Keeping
//! the entropy path small and dependency-free makes it auditable in one sitting.
//!
//! Source: `rdseed` — the CPU's on-die thermal-noise entropy source exposed via
//! the RDSEED instruction (NOT rdrand, which is a CSPRNG reseeded by it). This
//! is a genuine physical, nondeterministic source. It is whitened on-die and
//! vendor-opaque, so PsiMeter treats it as PILOT-GRADE / non-confirmatory (D1).
//!
//! This program performs NO conditioning/whitening of its own (spec D10).
//!
//! Usage:
//!   entropy-provider --bytes N            # write N raw bytes to stdout (binary)
//!   entropy-provider --info               # write JSON metadata to stdout
//!   entropy-provider --source rdseed ...  # only `rdseed` is implemented so far

use std::io::{self, Write};
use std::process::exit;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let mut source = String::from("rdseed");
    let mut bytes: usize = 0;
    let mut info = false;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--source" => {
                i += 1;
                if i < args.len() {
                    source = args[i].clone();
                }
            }
            "--bytes" => {
                i += 1;
                if i < args.len() {
                    bytes = args[i].parse().unwrap_or(0);
                }
            }
            "--info" => info = true,
            other => {
                eprintln!("unknown argument: {}", other);
                exit(2);
            }
        }
        i += 1;
    }

    if source != "rdseed" {
        eprintln!("source '{}' not implemented in this sidecar", source);
        exit(2);
    }

    let available = rdseed_available();

    if info {
        // Minimal, machine-readable metadata copied verbatim into the session record.
        println!(
            "{{\"id\":\"rdseed\",\"kind\":\"cpu-rdseed\",\"confirmatory\":false,\"available\":{},\"conditioning\":\"none\",\"instruction\":\"RDSEED\"}}",
            available
        );
        return;
    }

    if !available {
        eprintln!("RDSEED is not available on this CPU; refusing to emit non-physical bytes");
        exit(1);
    }

    let stdout = io::stdout();
    let mut out = stdout.lock();
    let mut remaining = bytes;
    while remaining > 0 {
        let value = unsafe { rdseed64() };
        let take = if remaining < 8 { remaining } else { 8 };
        let le = value.to_le_bytes();
        if out.write_all(&le[..take]).is_err() {
            exit(3);
        }
        remaining -= take;
    }
    let _ = out.flush();
}

#[cfg(target_arch = "x86_64")]
fn rdseed_available() -> bool {
    std::is_x86_feature_detected!("rdseed")
}
#[cfg(not(target_arch = "x86_64"))]
fn rdseed_available() -> bool {
    false
}

/// Pull one 64-bit value from the hardware entropy source, retrying until the
/// CPU signals success. RDSEED sets the carry flag (returns 1) on success; under
/// heavy draw it may return 0 (entropy not yet ready), and the Intel-recommended
/// response is simply to retry.
///
/// # Safety
/// Caller must ensure the `rdseed` feature is available (see `rdseed_available`).
#[cfg(target_arch = "x86_64")]
#[target_feature(enable = "rdseed")]
unsafe fn rdseed64() -> u64 {
    use core::arch::x86_64::_rdseed64_step;
    let mut value: u64 = 0;
    loop {
        if _rdseed64_step(&mut value) == 1 {
            return value;
        }
        core::hint::spin_loop();
    }
}
#[cfg(not(target_arch = "x86_64"))]
unsafe fn rdseed64() -> u64 {
    unreachable!()
}
