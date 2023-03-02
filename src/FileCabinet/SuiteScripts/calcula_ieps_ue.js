/**
 * ! BACKUP
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/runtime', 'N/search'],
    /**
 * @param{record} record
 * @param{runtime} runtime
 * @param{search} search
 */
    (record, runtime, search) => {

        const afterSubmit = (context) => {
            try {
                if (context.type == context.UserEventType.CREATE || context.type == context.UserEventType.EDIT) {
                    var suitetax = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });
                    log.audit({title: 'suitetax', details: suitetax});
                    var reg = context.newRecord;
                    var record_type = reg.type;
                    if (record_type == record.Type.CREDIT_MEMO && suitetax) {
                        var record_now = record.load({
                            type: record_type,
                            id: reg.id,
                            isDynamic: true
                        })
                    } else {
                        var record_now = record.load({
                            type: record_type,
                            id: reg.id,
                            isDynamic: false
                        })
                    }

                    if (suitetax) {

                        /* // obtiene macros
                        var macros = record_now.getMacros();
                        // execute the macro
                        if ('calculateTax' in macros) {
                            macros.calculateTax(); // For promise version use: macros.calculateTax.promise()
                        } */

                        var cant_impuestos = record_now.getLineCount({sublistId: 'taxdetails'});
                        log.audit({title: 'cant_impuestos', details: cant_impuestos});


                        if (cant_impuestos > 0) {
                            // * Activa el check de anulacion de impuestos para editar las lineas
                            record_now.setValue({
                                fieldId: 'taxdetailsoverride',
                                value: true
                            });

                            for (var line = 0; line < cant_impuestos; line++) {

                                var ref_impuesto = record_now.getSublistValue({
                                    sublistId: 'taxdetails',
                                    fieldId: 'taxdetailsreference',
                                    line: line
                                });
                                log.audit({title: 'ref_impuesto', details: ref_impuesto});

                                var tax_type = record_now.getSublistText({
                                    sublistId: 'taxdetails',
                                    fieldId: 'taxtype',
                                    line: line
                                })
                                log.audit({title: 'tax_type', details: tax_type});

                                var tax_base = record_now.getSublistValue({
                                    sublistId: 'taxdetails',
                                    fieldId: 'taxbasis',
                                    line: line
                                })
                                log.audit({title: 'tax_base', details: tax_base});

                                if (tax_type == "IEPS") {
                                    log.audit({title: 'LOG', details: 'Encuentra IEPS y salta a la sig linea'});
                                    var tax_base_ieps = record_now.getSublistValue({
                                        sublistId: 'taxdetails',
                                        fieldId: 'taxbasis',
                                        line: line
                                    })
                                    log.audit({title: 'tax_base_ieps', details: tax_base_ieps});
                                    continue;
                                }

                                for (let lineaux = 0; lineaux < cant_impuestos; lineaux++) {
                                    log.audit({title: 'LOG', details: 'Entra en el segundo recorrido'});
                                    var tax_base_aux = record_now.getSublistValue({
                                        sublistId: 'taxdetails',
                                        fieldId: 'taxbasis',
                                        line: lineaux
                                    });
                                    log.audit({title: 'tax_base_ieps_antes_if', details: tax_base_ieps});
                                    log.audit({title: 'tax_base_aux_antes_if', details: tax_base_aux});
                                    if (tax_base_aux == tax_base_ieps ) {
                                        log.audit({title: 'LOG', details: 'Entra al if porque ' + tax_base_aux + ' es igual que ' + tax_base_ieps});
                                        var ref_impuesto_aux = record_now.getSublistValue({
                                            sublistId: 'taxdetails',
                                            fieldId: 'taxdetailsreference',
                                            line: lineaux
                                        })
                                        log.audit({title: 'ref_impuesto_aux', details: ref_impuesto_aux});

                                        var tax_type_aux = record_now.getSublistText({
                                            sublistId: 'taxdetails',
                                            fieldId: 'taxtype',
                                            line: lineaux
                                        })
                                        log.audit({title: 'tax_type_aux', details: tax_type_aux});

                                        var tax_rate = record_now.getSublistValue({
                                            sublistId: 'taxdetails',
                                            fieldId: 'taxrate',
                                            line: lineaux
                                        })
                                        log.audit({title: 'tax_rate', details: tax_rate});

                                        if (tax_type_aux == "IEPS") {
                                            var monto_ieps = tax_base_aux * (tax_rate/100);
                                            log.audit({title: 'monto_ieps', details: monto_ieps});
                                        }
                                        log.audit({title: 'LOG', details: 'tax_base: ' + tax_base + ' tax_base_aux: ' + tax_base_aux});

                                        if ( ref_impuesto_aux == ref_impuesto  && tax_type_aux != "IEPS") {
                                            // log.audit({title: 'LOG', details: 'Aqui está el impuesto: ' + tax_type_aux + ' con referencia: ' + ref_impuesto_aux});
                                            // ! Aquí se opera el IEPS para que se calcule bien el IVA
                                            var base_iva = (tax_base_aux + monto_ieps);
                                            log.audit({title: 'iva_con_ieps', details: 'base correcta de IVA: ' +base_iva});
                                            var iva_con_ieps = (tax_base_aux + monto_ieps) * (tax_rate/100);
                                            log.audit({title: 'iva_con_ieps', details: 'IVA sobre IEPS: ' +iva_con_ieps});

                                            record_now.setSublistValue({
                                                sublistId: 'taxdetails',
                                                fieldId: 'taxbasis',
                                                line: lineaux,
                                                value: base_iva
                                            });

                                            record_now.setSublistValue({
                                                sublistId: 'taxdetails',
                                                fieldId: 'taxamount',
                                                line: lineaux,
                                                value: iva_con_ieps
                                            })
                                            log.audit({title: 'LOG', details: 'Valor puesto en base de impuesto: ' + base_iva});
                                            log.audit({title: 'LOG', details: 'Valor puesto en monto de impuesto: ' + iva_con_ieps});


                                        }
                                    }

                                }
                            }
                            record_now.save({ enableSourcing: false, ignoreMandatoryFields: true });
                        }
                    }
                }
            } catch (error) {
                log.error({title: 'error en as', details: error});
            }
        }

return { afterSubmit }

    });
