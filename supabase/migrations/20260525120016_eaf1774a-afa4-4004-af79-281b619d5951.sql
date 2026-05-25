CREATE OR REPLACE FUNCTION public.validate_form_field_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.field_type NOT IN ('short_text','long_text','select','multi_select','date','file','state_city','partner_group','address','cnpj') THEN
    RAISE EXCEPTION 'invalid field type: %', NEW.field_type;
  END IF;
  RETURN NEW;
END;
$function$;