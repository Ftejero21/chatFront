package com.chat.chat.Security;

import com.chat.chat.Exceptions.SqlInjectionException;
import org.springframework.stereotype.Component;

import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.time.temporal.Temporal;
import java.util.Collection;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Map;
import java.util.Set;

@Component
public class SqlInjectionRequestValidator {

    private final SqlInjectionDetector detector;

    public SqlInjectionRequestValidator(SqlInjectionDetector detector) {
        this.detector = detector;
    }

    public void validate(Object body) {
        Set<Object> visited = Collections.newSetFromMap(new IdentityHashMap<>());
        validateRecursive(body, "body", visited);
    }

    private void validateRecursive(Object value, String path, Set<Object> visited) {
        if (value == null) {
            return;
        }

        if (value instanceof String str) {
            if (detector.containsRisk(str)) {
                throw new SqlInjectionException("Entrada invalida detectada en " + path + ": posible SQL Injection");
            }
            return;
        }

        Class<?> clazz = value.getClass();

        if (clazz.isArray()) {
            if (clazz.getComponentType().isPrimitive()) {
                return;
            }
            int length = Array.getLength(value);
            for (int i = 0; i < length; i++) {
                validateRecursive(Array.get(value, i), path + "[" + i + "]", visited);
            }
            return;
        }

        if (value instanceof Collection<?> collection) {
            int i = 0;
            for (Object item : collection) {
                validateRecursive(item, path + "[" + i + "]", visited);
                i++;
            }
            return;
        }

        if (value instanceof Map<?, ?> map) {
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                String key = String.valueOf(entry.getKey());
                validateRecursive(entry.getValue(), path + "." + key, visited);
            }
            return;
        }

        if (value instanceof java.util.Optional<?> optional) {
            optional.ifPresent(item -> validateRecursive(item, path + ".value", visited));
            return;
        }

        if (isSimpleType(clazz)) {
            return;
        }

        if (visited.contains(value)) {
            return;
        }
        visited.add(value);

        Class<?> current = clazz;
        while (current != null && current != Object.class) {
            for (Field field : current.getDeclaredFields()) {
                if (Modifier.isStatic(field.getModifiers()) || field.isSynthetic()) {
                    continue;
                }
                boolean canAccess = field.canAccess(value);
                try {
                    if (!canAccess) {
                        field.setAccessible(true);
                    }
                    Object fieldValue = field.get(value);
                    validateRecursive(fieldValue, path + "." + field.getName(), visited);
                } catch (IllegalAccessException ignored) {
                    // No rompe la request por campos no accesibles; continúa con el resto.
                } finally {
                    if (!canAccess) {
                        try {
                            field.setAccessible(false);
                        } catch (Exception ignored) {
                            // No-op
                        }
                    }
                }
            }
            current = current.getSuperclass();
        }
    }

    private boolean isSimpleType(Class<?> type) {
        return type.isPrimitive()
                || Number.class.isAssignableFrom(type)
                || CharSequence.class.isAssignableFrom(type)
                || Boolean.class == type
                || Character.class == type
                || Enum.class.isAssignableFrom(type)
                || Temporal.class.isAssignableFrom(type)
                || type.getName().startsWith("java.");
    }
}
