use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

use super::RELAY_WEBSOCKET_ORIGIN;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct RemoteRelayIdentity {
    pub relay_id: String,
    pub credential: String,
}

impl RemoteRelayIdentity {
    pub fn load_or_create(path: &Path) -> Result<Self, String> {
        match fs::read_to_string(path) {
            Ok(value) => serde_json::from_str(&value).map_err(|error| error.to_string()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                let identity = Self {
                    relay_id: random_token()?,
                    credential: random_token()?,
                };
                let parent = path
                    .parent()
                    .ok_or_else(|| "relay identity path has no parent".to_string())?;
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
                fs::write(
                    path,
                    serde_json::to_vec(&identity).map_err(|error| error.to_string())?,
                )
                .map_err(|error| error.to_string())?;
                Ok(identity)
            }
            Err(error) => Err(error.to_string()),
        }
    }

    pub fn endpoint(&self) -> String {
        format!("{RELAY_WEBSOCKET_ORIGIN}/relay/{}", self.relay_id)
    }
}

fn random_token() -> Result<String, String> {
    let mut bytes = [0_u8; 32];
    getrandom::fill(&mut bytes).map_err(|error| error.to_string())?;
    Ok(URL_SAFE_NO_PAD.encode(bytes))
}
