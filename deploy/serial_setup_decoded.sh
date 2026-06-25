#!/bin/bash

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "This script must be run as root"
    exit 1
fi

# Set up logging
LOG_FILE="/var/log/serial_setup.log"
exec > >(tee -a "$LOG_FILE") 2>&1

# Function to check serial port
check_serial_port() {
    if [ -c /dev/ttyS0 ]; then
        echo "Serial port /dev/ttyS0 exists"
        if stty -F /dev/ttyS0 >/dev/null 2>&1; then
            echo "Current port settings:"
            stty -F /dev/ttyS0
            return 0
        else
            echo "Port /dev/ttyS0 exists but is not accessible"
            return 1
        fi
    else
        echo "Serial port /dev/ttyS0 not found"
        echo "Checking available serial ports..."
        ls -l /dev/tty* | grep -E '(ttyS|ttyUSB|ttyACM)'
        return 1
    fi
}

# Function to check kernel command line
check_kernel_cmdline() {
    if grep -q "console=ttyS0" /proc/cmdline; then
        echo "Serial port ttyS0 is already activated in kernel parameters"
        return 0
    else
        echo "Serial port ttyS0 is not activated in kernel parameters"
        return 1
    fi
}

# Function to check console service status
check_console_service() {
    if command -v systemctl >/dev/null 2>&1; then
        if systemctl is-active --quiet serial-getty@ttyS0.service; then
            echo "Service serial-getty@ttyS0.service is active"
            return 0
        else
            echo "Service serial-getty@ttyS0.service is not active"
            return 1
        fi
    elif command -v rc-status >/dev/null 2>&1; then
        if rc-status | grep -q "getty.ttyS0"; then
            echo "Service getty.ttyS0 is active"
            return 0
        else
            echo "Service getty.ttyS0 is not active"
            return 1
        fi
    else
        echo "Unable to determine console service status"
        return 1
    fi
}

# Function to detect bootloader
detect_bootloader() {
    if [ -f /boot/grub/grub.cfg ]; then
        echo "grub"
    elif [ -f /boot/syslinux/syslinux.cfg ]; then
        echo "syslinux"
    else
        echo "unknown"
    fi
}

# Function to configure GRUB
configure_grub() {
    local grub_file="/etc/default/grub"
    if [ ! -f "$grub_file" ]; then
        echo "GRUB file not found at $grub_file"
        return 1
    fi
    if grep -q "console=ttyS0" "$grub_file"; then
        echo "Parameter console=ttyS0 already added in GRUB"
    else
        if grep -q "GRUB_CMDLINE_LINUX_DEFAULT=" "$grub_file"; then
            sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT="\(.*\)"/GRUB_CMDLINE_LINUX_DEFAULT="\1 console=ttyS0,115200n8"/' "$grub_file"
            echo "Parameter added to GRUB_CMDLINE_LINUX_DEFAULT"
        elif grep -q "GRUB_CMDLINE_LINUX=" "$grub_file"; then
            sed -i 's/GRUB_CMDLINE_LINUX="\(.*\)"/GRUB_CMDLINE_LINUX="\1 console=ttyS0,115200n8"/' "$grub_file"
            echo "Parameter added to GRUB_CMDLINE_LINUX"
        else
            echo "GRUB_CMDLINE_LINUX_DEFAULT=\"console=ttyS0,115200n8\"" >> "$grub_file"
            echo "Created new GRUB_CMDLINE_LINUX_DEFAULT parameter"
        fi
    fi
    return 0
}

# Function to configure Syslinux
configure_syslinux() {
    local syslinux_cfg="/boot/syslinux/syslinux.cfg"
    if [ ! -f "$syslinux_cfg" ]; then
        echo "Syslinux configuration file not found at $syslinux_cfg"
        return 1
    fi
    # Check if SERIAL directive is present
    if grep -q "^SERIAL" "$syslinux_cfg"; then
        echo "SERIAL directive already present in Syslinux configuration"
    else
        # Add SERIAL 0 115200 at the beginning
        sed -i '1i SERIAL 0 115200' "$syslinux_cfg"
        echo "Added SERIAL directive to Syslinux configuration"
    fi
    # Check if console=ttyS0,115200n8 is in the APPEND line
    if grep -q "console=ttyS0,115200n8" "$syslinux_cfg"; then
        echo "Kernel parameter console=ttyS0,115200n8 already present in Syslinux configuration"
    else
        # Add the parameter to all APPEND lines
        sed -i '/^APPEND/s/$/ console=ttyS0,115200n8/' "$syslinux_cfg"
        echo "Added console=ttyS0,115200n8 to APPEND line in Syslinux configuration"
    fi
    return 0
}

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
elif [ -f /etc/lsb-release ]; then
    . /etc/lsb-release
    OS=$DISTRIB_ID
    VERSION=$DISTRIB_RELEASE
else
    OS=$(uname -s)
    VERSION=$(uname -r)
fi
echo "Detected operating system: $OS $VERSION"

# Check for systemd
has_systemd=false
if command -v systemctl >/dev/null 2>&1; then
    has_systemd=true
fi

# Perform initial checks
check_serial_port
check_kernel_cmdline
kernel_port_active=$?
check_console_service
console_service_active=$?

# Check if already configured
if [ "$kernel_port_active" -eq 0 ] && [ "$console_service_active" -eq 0 ]; then
    echo "Serial port ttyS0 is already fully configured"
    read -p "Do you want to continue with the setup? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Operation cancelled"
        exit 0
    fi
fi

# Configure based on OS and bootloader
case $OS in
    ubuntu|debian|linuxmint|pop|elementary|zorin)
        echo "Configuring for Debian/Ubuntu-like system..."
        bootloader=$(detect_bootloader)
        case $bootloader in
            grub)
                configure_grub || { echo "Failed to configure GRUB"; exit 1; }
                update-grub || { echo "Failed to update GRUB"; exit 1; }
                ;;
            syslinux)
                configure_syslinux || { echo "Failed to configure Syslinux"; exit 1; }
                ;;
            unknown)
                echo "Unknown bootloader, cannot configure automatically"
                exit 1
                ;;
        esac
        if [ "$has_systemd" = true ]; then
            systemctl enable serial-getty@ttyS0.service || { echo "Failed to enable service"; exit 1; }
            systemctl start serial-getty@ttyS0.service || { echo "Failed to start service"; exit 1; }
            echo "Service serial-getty@ttyS0.service enabled and started"
        fi
        ;;
    rhel|centos|fedora|rocky|almalinux|ol|amzn)
        echo "Configuring for RHEL/CentOS/Fedora-like system..."
        bootloader=$(detect_bootloader)
        case $bootloader in
            grub)
                configure_grub || { echo "Failed to configure GRUB"; exit 1; }
                if [ -d /sys/firmware/efi ]; then
                    grub2-mkconfig -o /boot/efi/EFI/redhat/grub.cfg || grub2-mkconfig -o /boot/efi/EFI/centos/grub.cfg || grub2-mkconfig -o /boot/efi/EFI/fedora/grub.cfg || { echo "Failed to update GRUB"; exit 1; }
                else
                    grub2-mkconfig -o /boot/grub2/grub.cfg || { echo "Failed to update GRUB"; exit 1; }
                fi
                ;;
            syslinux)
                configure_syslinux || { echo "Failed to configure Syslinux"; exit 1; }
                ;;
            unknown)
                echo "Unknown bootloader, cannot configure automatically"
                exit 1
                ;;
        esac
        if [ "$has_systemd" = true ]; then
            systemctl enable serial-getty@ttyS0.service || { echo "Failed to enable service"; exit 1; }
            systemctl start serial-getty@ttyS0.service || { echo "Failed to start service"; exit 1; }
            echo "Service serial-getty@ttyS0.service enabled and started"
        fi
        ;;
    arch|manjaro|endeavouros)
        echo "Configuring for Arch-like system..."
        bootloader=$(detect_bootloader)
        case $bootloader in
            grub)
                configure_grub || { echo "Failed to configure GRUB"; exit 1; }
                grub-mkconfig -o /boot/grub/grub.cfg || { echo "Failed to update GRUB"; exit 1; }
                ;;
            syslinux)
                configure_syslinux || { echo "Failed to configure Syslinux"; exit 1; }
                ;;
            unknown)
                echo "Unknown bootloader, cannot configure automatically"
                exit 1
                ;;
        esac
        if [ "$has_systemd" = true ]; then
            systemctl enable serial-getty@ttyS0.service || { echo "Failed to enable service"; exit 1; }
            systemctl start serial-getty@ttyS0.service || { echo "Failed to start service"; exit 1; }
            echo "Service serial-getty@ttyS0.service enabled and started"
        fi
        ;;
    suse|opensuse|opensuse-leap|opensuse-tumbleweed)
        echo "Configuring for openSUSE..."
        bootloader=$(detect_bootloader)
        case $bootloader in
            grub)
                configure_grub || { echo "Failed to configure GRUB"; exit 1; }
                grub2-mkconfig -o /boot/grub2/grub.cfg || { echo "Failed to update GRUB"; exit 1; }
                ;;
            syslinux)
                configure_syslinux || { echo "Failed to configure Syslinux"; exit 1; }
                ;;
            unknown)
                echo "Unknown bootloader, cannot configure automatically"
                exit 1
                ;;
        esac
        if [ "$has_systemd" = true ]; then
            systemctl enable serial-getty@ttyS0.service || { echo "Failed to enable service"; exit 1; }
            systemctl start serial-getty@ttyS0.service || { echo "Failed to start service"; exit 1; }
            echo "Service serial-getty@ttyS0.service enabled and started"
        fi
        ;;
    gentoo)
        echo "Configuring for Gentoo..."
        bootloader=$(detect_bootloader)
        case $bootloader in
            grub)
                configure_grub || { echo "Failed to configure GRUB"; exit 1; }
                grub-mkconfig -o /boot/grub/grub.cfg || { echo "Failed to update GRUB"; exit 1; }
                ;;
            syslinux)
                configure_syslinux || { echo "Failed to configure Syslinux"; exit 1; }
                ;;
            unknown)
                echo "Unknown bootloader, cannot configure automatically"
                exit 1
                ;;
        esac
        if [ "$has_systemd" = true ]; then
            systemctl enable serial-getty@ttyS0.service || { echo "Failed to enable service"; exit 1; }
            systemctl start serial-getty@ttyS0.service || { echo "Failed to start service"; exit 1; }
            echo "Service serial-getty@ttyS0.service enabled and started"
        else
            rc-update add getty.ttyS0 default || { echo "Failed to add service"; exit 1; }
            /etc/init.d/getty.ttyS0 start || { echo "Failed to start service"; exit 1; }
            echo "Service getty.ttyS0 added and started"
        fi
        ;;
    alpine)
        echo "Configuring for Alpine Linux..."
        if [ -f /etc/update-extlinux.conf ]; then
            sed -i 's/default_kernel_opts="\(.*\)"/default_kernel_opts="\1 console=ttyS0,115200n8"/' /etc/update-extlinux.conf
            update-extlinux || { echo "Failed to update extlinux"; exit 1; }
        else
            echo "File /etc/update-extlinux.conf not found"
            bootloader=$(detect_bootloader)
            case $bootloader in
                grub)
                    configure_grub || { echo "Failed to configure GRUB"; exit 1; }
                    grub-mkconfig -o /boot/grub/grub.cfg || { echo "Failed to update GRUB"; exit 1; }
                    ;;
                syslinux)
                    configure_syslinux || { echo "Failed to configure Syslinux"; exit 1; }
                    ;;
                unknown)
                    echo "Unknown bootloader, cannot configure automatically"
                    exit 1
                    ;;
            esac
        fi
        if [ "$has_systemd" = true ]; then
            systemctl enable serial-getty@ttyS0.service || { echo "Failed to enable service"; exit 1; }
            systemctl start serial-getty@ttyS0.service || { echo "Failed to start service"; exit 1; }
            echo "Service serial-getty@ttyS0.service enabled and started"
        else
            rc-update add getty.ttyS0 default || { echo "Failed to add service"; exit 1; }
            rc-service getty.ttyS0 start || { echo "Failed to start service"; exit 1; }
            echo "Service getty.ttyS0 added and started"
        fi
        ;;
    *)
        echo "Unknown OS: $OS"
        echo "Trying general method..."
        bootloader=$(detect_bootloader)
        case $bootloader in
            grub)
                configure_grub || { echo "Failed to configure GRUB"; exit 1; }
                if command -v update-grub >/dev/null 2>&1; then
                    update-grub || { echo "Failed to update GRUB"; exit 1; }
                elif command -v grub-mkconfig >/dev/null 2>&1; then
                    grub-mkconfig -o /boot/grub/grub.cfg || { echo "Failed to update GRUB"; exit 1; }
                elif command -v grub2-mkconfig >/dev/null 2>&1; then
                    if [ -d /sys/firmware/efi ]; then
                        grub2-mkconfig -o /boot/efi/EFI/$(echo $OS | tr '[:upper:]' '[:lower:]')/grub.cfg || { echo "Failed to update GRUB"; exit 1; }
                    else
                        grub2-mkconfig -o /boot/grub2/grub.cfg || { echo "Failed to update GRUB"; exit 1; }
                    fi
                else
                    echo "WARNING: Unable to update GRUB configuration"
                    echo "Please update the bootloader configuration manually"
                fi
                ;;
            syslinux)
                configure_syslinux || { echo "Failed to configure Syslinux"; exit 1; }
                ;;
            unknown)
                echo "Unknown bootloader, cannot configure automatically"
                exit 1
                ;;
        esac
        if [ "$has_systemd" = true ]; then
            systemctl enable serial-getty@ttyS0.service || { echo "Failed to enable service"; exit 1; }
            systemctl start serial-getty@ttyS0.service || { echo "Failed to start service"; exit 1; }
            echo "Service serial-getty@ttyS0.service enabled and started"
        elif command -v rc-update >/dev/null 2>&1; then
            rc-update add getty.ttyS0 default || { echo "Failed to add service"; exit 1; }
            rc-service getty.ttyS0 start || /etc/init.d/getty.ttyS0 start || { echo "Failed to start service"; exit 1; }
            echo "Service getty.ttyS0 added and started"
        fi
        ;;
esac

# Final checks
echo -e "\nChecking serial port configuration..."
check_serial_port

# Prompt for reboot
echo -e "\nSetup completed. A reboot is required to apply kernel parameters."
read -p "Reboot now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Rebooting..."
    reboot
else
    echo "Remember to reboot the system later to apply changes."
fi
