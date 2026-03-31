package com.chat.chat.Service.UsuarioService;

import com.chat.chat.DTO.DashboardStatsDTO;
import com.chat.chat.Entity.SolicitudDesbaneoEntity;
import com.chat.chat.Repository.ChatRepository;
import com.chat.chat.Repository.MensajeRepository;
import com.chat.chat.Repository.SolicitudDesbaneoRepository;
import com.chat.chat.Repository.UsuarioRepository;
import com.chat.chat.Security.CustomUserDetailsService;
import com.chat.chat.Security.JwtService;
import com.chat.chat.Service.AuthService.PasswordChangeService;
import com.chat.chat.Service.EmailService.EmailService;
import com.chat.chat.Utils.AdminAuditCrypto;
import com.chat.chat.Utils.SecurityUtils;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.TimeZone;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsuarioServiceImplDashboardStatsTest {

    @Mock
    private UsuarioRepository usuarioRepository;
    @Mock
    private EmailService emailService;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private ChatRepository chatRepository;
    @Mock
    private MensajeRepository mensajeRepository;
    @Mock
    private SolicitudDesbaneoRepository solicitudDesbaneoRepository;
    @Mock
    private SimpMessagingTemplate messagingTemplate;
    @Mock
    private JwtService jwtService;
    @Mock
    private CustomUserDetailsService customUserDetailsService;
    @Mock
    private SecurityUtils securityUtils;
    @Mock
    private PasswordChangeService passwordChangeService;
    @Mock
    private AdminAuditCrypto adminAuditCrypto;

    @InjectMocks
    private UsuarioServiceImpl service;

    private TimeZone originalTimeZone;

    @BeforeEach
    void setUpTimezone() {
        originalTimeZone = TimeZone.getDefault();
    }

    @AfterEach
    void restoreTimezone() {
        TimeZone.setDefault(originalTimeZone);
    }

    @Test
    void getDashboardStats_calculaHoyVsAyerConReglaUnica() {
        when(usuarioRepository.count()).thenReturn(120L);
        when(usuarioRepository.countUsuariosRegistradosEntreFechas(any(), any()))
                .thenReturn(10L, 8L);

        when(chatRepository.count()).thenReturn(50L);
        when(chatRepository.countChatsEntreFechas(any(), any()))
                .thenReturn(6L, 3L);

        when(mensajeRepository.countMensajesEntreFechas(any(), any()))
                .thenReturn(25L, 20L);

        when(solicitudDesbaneoRepository.findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(any(), any()))
                .thenReturn(
                        List.of(
                                solicitud(1L, "a@test.com"),
                                solicitud(1L, "a@test.com"),
                                solicitud(null, "  b@test.com "),
                                solicitud(null, "c@test.com")),
                        List.of(
                                solicitud(2L, "z@test.com"),
                                solicitud(null, "b@test.com")));

        DashboardStatsDTO stats = service.getDashboardStats(null);

        assertEquals(120L, stats.getTotalUsuarios());
        assertEquals(25.0, stats.getPorcentajeUsuarios());
        assertEquals(25.0, stats.getPorcentajeUsuariosHoy());

        assertEquals(50L, stats.getChatsActivos());
        assertEquals(6L, stats.getChatsCreadosHoy());
        assertEquals(100.0, stats.getPorcentajeChats());
        assertEquals(100.0, stats.getPorcentajeChatsHoy());

        assertEquals(3L, stats.getReportes());
        assertEquals(3L, stats.getReportesDiariosHoy());
        assertEquals(50.0, stats.getPorcentajeReportes());
        assertEquals(50.0, stats.getPorcentajeReportesHoy());

        assertEquals(25L, stats.getMensajesHoy());
        assertEquals(25.0, stats.getPorcentajeMensajes());
        assertEquals(25.0, stats.getPorcentajeMensajesHoy());
    }

    @Test
    void getDashboardStats_siAyerYCeroHoyYCero_devuelvePorcentajeCero() {
        when(usuarioRepository.count()).thenReturn(0L);
        when(usuarioRepository.countUsuariosRegistradosEntreFechas(any(), any()))
                .thenReturn(0L, 0L);
        when(chatRepository.count()).thenReturn(0L);
        when(chatRepository.countChatsEntreFechas(any(), any()))
                .thenReturn(0L, 0L);
        when(mensajeRepository.countMensajesEntreFechas(any(), any()))
                .thenReturn(0L, 0L);
        when(solicitudDesbaneoRepository.findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(any(), any()))
                .thenReturn(List.of(), List.of());

        DashboardStatsDTO stats = service.getDashboardStats(null);

        assertEquals(0.0, stats.getPorcentajeUsuariosHoy());
        assertEquals(0.0, stats.getPorcentajeChatsHoy());
        assertEquals(0.0, stats.getPorcentajeReportesHoy());
        assertEquals(0.0, stats.getPorcentajeMensajesHoy());
    }

    @Test
    void getDashboardStats_siAyerCeroYHoyMayorACero_devuelveCien() {
        when(usuarioRepository.count()).thenReturn(10L);
        when(usuarioRepository.countUsuariosRegistradosEntreFechas(any(), any()))
                .thenReturn(1L, 0L);
        when(chatRepository.count()).thenReturn(10L);
        when(chatRepository.countChatsEntreFechas(any(), any()))
                .thenReturn(2L, 0L);
        when(mensajeRepository.countMensajesEntreFechas(any(), any()))
                .thenReturn(3L, 0L);
        when(solicitudDesbaneoRepository.findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(any(), any()))
                .thenReturn(
                        List.of(solicitud(7L, "x@test.com"), solicitud(null, "y@test.com")),
                        List.of());

        DashboardStatsDTO stats = service.getDashboardStats(null);

        assertEquals(100.0, stats.getPorcentajeUsuariosHoy());
        assertEquals(100.0, stats.getPorcentajeChatsHoy());
        assertEquals(100.0, stats.getPorcentajeReportesHoy());
        assertEquals(100.0, stats.getPorcentajeMensajesHoy());
    }

    @Test
    void getDashboardStats_conTz_aplicaVentanasSegunZonaSolicitada() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));

        when(usuarioRepository.count()).thenReturn(0L);
        when(usuarioRepository.countUsuariosRegistradosEntreFechas(any(), any()))
                .thenReturn(0L, 0L);
        when(chatRepository.count()).thenReturn(0L);
        when(chatRepository.countChatsEntreFechas(any(), any()))
                .thenReturn(0L, 0L);
        when(mensajeRepository.countMensajesEntreFechas(any(), any()))
                .thenReturn(0L, 0L);
        when(solicitudDesbaneoRepository.findByCreatedAtGreaterThanEqualAndCreatedAtLessThan(any(), any()))
                .thenReturn(List.of(), List.of());

        service.getDashboardStats("America/Bogota");

        ArgumentCaptor<LocalDateTime> fromCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        ArgumentCaptor<LocalDateTime> toCaptor = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(usuarioRepository, times(2)).countUsuariosRegistradosEntreFechas(fromCaptor.capture(), toCaptor.capture());

        List<LocalDateTime> froms = fromCaptor.getAllValues();
        List<LocalDateTime> tos = toCaptor.getAllValues();

        LocalDateTime inicioDia = froms.get(0);
        LocalDateTime finDia = tos.get(0);
        LocalDateTime inicioAyer = froms.get(1);
        LocalDateTime finAyer = tos.get(1);

        assertEquals(inicioDia, finAyer);
        assertEquals(5, inicioDia.getHour());
        assertEquals(0, inicioDia.getMinute());
        assertEquals(0, inicioDia.getSecond());
        assertTrue(finDia.isAfter(inicioDia));
        assertTrue(inicioDia.isAfter(inicioAyer));
    }

    private static SolicitudDesbaneoEntity solicitud(Long usuarioId, String email) {
        SolicitudDesbaneoEntity entity = new SolicitudDesbaneoEntity();
        entity.setUsuarioId(usuarioId);
        entity.setEmail(email);
        return entity;
    }
}
