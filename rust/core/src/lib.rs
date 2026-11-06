//! Platform-independent lyric timing. No browser, Node runtime or network required.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Line {
    pub time_ms: i64,
    pub text: String,
}

pub fn parse_lrc(input: &str) -> Vec<Line> {
    let mut result = Vec::new();
    let mut offset = 0;
    for raw in input.trim_start_matches('\u{feff}').lines() {
        let mut remaining = raw.trim();
        if let Some(value) = remaining
            .strip_prefix("[offset:")
            .and_then(|s| s.strip_suffix(']'))
        {
            offset = value.parse::<i64>().unwrap_or(0).clamp(-300_000, 300_000);
            continue;
        }
        let mut times = Vec::new();
        while let Some(tag) = remaining.strip_prefix('[') {
            let Some(end) = tag.find(']') else { break };
            let value = &tag[..end];
            let Some((min, sec)) = value.split_once(':') else {
                break;
            };
            let (Ok(minutes), Ok(seconds)) = (min.parse::<u32>(), sec.parse::<f64>()) else {
                break;
            };
            if !seconds.is_finite() || !(0.0..60.0).contains(&seconds) || minutes > 1440 {
                break;
            }
            times.push(i64::from(minutes) * 60_000 + (seconds * 1000.0).round() as i64);
            remaining = &tag[end + 1..];
        }
        for time_ms in times {
            result.push(Line {
                time_ms,
                text: remaining.trim().to_owned(),
            });
        }
    }
    for line in &mut result {
        line.time_ms = (line.time_ms - offset).max(0);
    }
    result.sort_by_key(|line| line.time_ms);
    let mut grouped: Vec<Line> = Vec::new();
    for line in result {
        if let Some(last) = grouped
            .last_mut()
            .filter(|last| last.time_ms == line.time_ms)
        {
            if !line.text.is_empty() && !last.text.split('\n').any(|text| text == line.text) {
                if !last.text.is_empty() {
                    last.text.push('\n');
                }
                last.text.push_str(&line.text);
            }
        } else {
            grouped.push(line);
        }
    }
    grouped
}

pub fn current_line(lines: &[Line], position_ms: i64, offset_ms: i64) -> Option<usize> {
    let count = lines.partition_point(|line| line.time_ms <= position_ms.saturating_add(offset_ms));
    count.checked_sub(1)
}

#[derive(Debug, Clone)]
pub struct Playback {
    pub position_ms: i64,
    pub duration_ms: Option<i64>,
    pub received_ms: i64,
    pub paused: bool,
    pub rate: f64,
}
impl Playback {
    pub fn position_at(&self, now_ms: i64) -> i64 {
        let elapsed = if self.paused {
            0
        } else {
            now_ms.saturating_sub(self.received_ms).clamp(0, 6000)
        };
        let rate = if self.rate.is_finite() {
            self.rate.clamp(0.0, 4.0)
        } else {
            1.0
        };
        self.position_ms
            .saturating_add((elapsed as f64 * rate) as i64)
            .clamp(0, self.duration_ms.filter(|n| *n > 0).unwrap_or(86_400_000))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn repeated_times_unicode_and_fraction() {
        let lines =
            parse_lrc("\u{feff}[ti:原创]\n[00:02.50][00:04.125]你好\n[00:01]第一句\n[00:06]");
        assert_eq!(
            lines.iter().map(|l| l.time_ms).collect::<Vec<_>>(),
            [1000, 2500, 4125, 6000]
        );
        assert_eq!(lines[1].text, "你好");
        assert_eq!(lines[3].text, "");
    }
    #[test]
    fn metadata_invalid_timestamps_and_global_offset() {
        let lines = parse_lrc("[00:01]一句\n[offset:-500]\n[99:99]无效\n[00:NaN]无效");
        assert_eq!(
            lines,
            vec![Line {
                time_ms: 1500,
                text: "一句".into()
            }]
        );
    }
    #[test]
    fn translations_merge_without_duplicates() {
        let lines = parse_lrc("[00:01]你好\n[00:01]Hello\n[00:01]你好");
        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].text, "你好\nHello");
    }
    #[test]
    fn seek_boundaries_and_instrumental() {
        let lines = parse_lrc("[00:01]一\n[00:02]\n[00:03]三");
        assert_eq!(current_line(&lines, 0, 0), None);
        assert_eq!(current_line(&lines, 1000, 0), Some(0));
        assert_eq!(current_line(&lines, 2000, 0), Some(1));
        assert_eq!(current_line(&lines, 2500, 500), Some(2));
        assert_eq!(current_line(&lines, 3500, -3000), None);
    }
    #[test]
    fn pause_duration_and_missing_heartbeat() {
        let mut p = Playback {
            position_ms: 1000,
            duration_ms: Some(20000),
            received_ms: 100,
            paused: false,
            rate: 1.0,
        };
        assert_eq!(p.position_at(1100), 2000);
        assert_eq!(p.position_at(90100), 7000);
        p.paused = true;
        assert_eq!(p.position_at(1100), 1000);
        p.paused = false;
        p.position_ms = 19900;
        assert_eq!(p.position_at(1100), 20000);
    }
}
