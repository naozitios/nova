-- Align persisted upload state with runtime/OpenAPI upload lifecycle enums.

update context_upload_intents
set status = case status
  when 'uploaded' then 'storing'
  when 'rejected' then 'failed'
  else status
end
where status in ('uploaded', 'rejected');

update context_upload_intents
set malware_scan_status = case malware_scan_status
  when 'suspicious' then 'infected'
  when 'unavailable' then 'error'
  when 'failed' then 'error'
  else malware_scan_status
end
where malware_scan_status in ('suspicious', 'unavailable', 'failed');

alter table context_upload_intents
  drop constraint if exists context_upload_intents_status_check,
  drop constraint if exists context_upload_intents_malware_scan_status_check;

alter table context_upload_intents
  alter column malware_scan_code type integer
  using case
    when malware_scan_code ~ '^-?[0-9]+$' then malware_scan_code::integer
    else null
  end;

alter table context_upload_intents
  add constraint context_upload_intents_status_check
    check (status in ('pending', 'scanning', 'storing', 'processing', 'completed', 'failed', 'expired')),
  add constraint context_upload_intents_malware_scan_status_check
    check (malware_scan_status in ('pending', 'clean', 'infected', 'error', 'skipped'));
